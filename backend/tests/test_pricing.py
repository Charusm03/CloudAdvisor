import csv
from decimal import Decimal

import pytest

from backend.config import ROOT
from backend.services.pricing_service import StaticPricingProvider


def test_csv_loads_and_has_all_providers_and_models():
    rows = StaticPricingProvider(str(ROOT / "data" / "pricing.csv")).get_prices()
    assert {r.provider for r in rows} == {"AWS", "Azure", "GCP"}
    assert {r.pricing_model for r in rows} == {"on_demand", "spot", "reserved"}
    assert all(r.price_per_hour > 0 and r.price_snapshot_date for r in rows)


def test_spot_and_reserved_cheaper_than_on_demand_for_same_instance():
    rows = StaticPricingProvider(str(ROOT / "data" / "pricing.csv")).get_prices()
    od = {(r.provider, r.region, r.instance_type): r.price_per_hour for r in rows if r.pricing_model == "on_demand"}
    for r in rows:
        if r.pricing_model != "on_demand":
            assert r.price_per_hour < od[(r.provider, r.region, r.instance_type)]


def test_bad_csv_rejected(tmp_path):
    p = tmp_path / "bad.csv"
    src = (ROOT / "data" / "pricing.csv").read_text().splitlines()
    p.write_text("\n".join(src[:2]).replace(",on_demand,", ",lease,") + "\n")
    with pytest.raises(ValueError):
        StaticPricingProvider(str(p)).get_prices()


def test_seeded_db_and_pricing_api(client):
    all_rows = client.get("/api/pricing").get_json()
    assert len(all_rows) > 200
    r = client.get("/api/pricing?provider=GCP&pricing_model=spot&min_vcpu=8&min_ram=32").get_json()
    assert r and all(x["provider"] == "GCP" and x["pricing_model"] == "spot" and x["vcpu"] >= 8 and x["ram_gb"] >= 32 for x in r)
    assert client.get("/api/pricing?region=eastus").get_json()


@pytest.mark.parametrize("qs", ["provider=Oracle", "pricing_model=lease", "min_vcpu=abc"])
def test_pricing_api_invalid_query_400(client, qs):
    assert client.get(f"/api/pricing?{qs}").status_code == 400
