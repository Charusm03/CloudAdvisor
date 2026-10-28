from datetime import date

from backend.app import create_app
from backend.evaluation.baselines import REFERENCE_WORKLOADS, evaluate, summarise
from backend.services.pricing_service import StaticPricingProvider, freshness
from pathlib import Path

REF = Path(__file__).parent / "fixtures" / "reference_pricing.csv"


def test_freshness_reports_age_and_status():
    assert freshness("2026-10-19", 30, today=date(2026, 10, 24)) == {
        "snapshot_date": "2026-10-19", "age_days": 5, "status": "fresh", "stale_after_days": 30}
    assert freshness("2026-01-01", 30, today=date(2026, 10, 24))["status"] == "stale"


def test_pricing_meta_endpoint(client):
    m = client.get("/api/pricing/meta").get_json()
    assert m["records"] > 200 and m["freshness"]["age_days"] >= 0 and set(m["regions"]) == {"AWS", "Azure", "GCP"}
    assert "us" in m["region_groups"] and "NVIDIA T4" in m["gpu_types"]


def test_preview_reports_pricing_freshness(client, payload):
    assert client.post("/api/recommendations/preview", json=payload).get_json()["pricing_freshness"]["status"] in ("fresh", "stale")


def test_pricing_api_gpu_filters(client):
    rows = client.get("/api/pricing?gpu_type=NVIDIA%20T4&min_gpu=1").get_json()
    assert rows and all(r["gpu_type"] == "NVIDIA T4" for r in rows)
    assert client.get("/api/pricing?min_gpu=abc").status_code == 400


def test_debug_is_off_by_default(app):
    assert app.config["DEBUG"] is False


def test_rate_limit_returns_429_and_exempts_health():
    a = create_app({"SQLALCHEMY_DATABASE_URI": "sqlite://", "TESTING": True, "RATE_LIMIT_REQUESTS": 3,
                    "RATE_LIMIT_WINDOW_SECONDS": 60})
    c = a.test_client()
    codes = [c.get("/api/pricing/meta").status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    assert c.get("/api/health").status_code == 200


def test_advisor_never_worse_than_baselines_on_reference_snapshot():
    rows = evaluate(StaticPricingProvider(str(REF)).get_prices(), REFERENCE_WORKLOADS)
    s = summarise(rows)
    assert s["advisor_never_worse"] and len(rows) == 5
    assert 40 < s["cheapest_on_demand"]["mean_saving_pct"] < 48  # report: about 44% average saving


def test_reseed_refresh(app):
    from backend.database.db import session_scope
    from backend.database.seed import seed_pricing
    with app.app_context(), session_scope() as s:
        assert seed_pricing(s, app.config["PRICING_CSV"]) == 0            # already seeded
        assert seed_pricing(s, app.config["PRICING_CSV"], reset=True) > 200  # --refresh reloads
