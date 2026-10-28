"""End-to-end W1-W5 acceptance tests on the report's reference snapshot (Tables 6.1-6.4), plus UT/IT/ST cases."""
from pathlib import Path

import pytest

from backend.services.pricing_service import StaticPricingProvider
from backend.services.recommendation_engine import recommend
from backend.evaluation.baselines import REFERENCE_WORKLOADS, make_workload

FIXTURE = Path(__file__).parent / "fixtures" / "reference_pricing.csv"


@pytest.fixture(scope="module")
def prices():
    return StaticPricingProvider(str(FIXTURE)).get_prices()


def run(prices, key):
    return recommend(make_workload(REFERENCE_WORKLOADS[key]), prices)


# (provider, model, instance, total, delta vs rank 1 %) - report Table 6.3
EXPECTED = {
    "W1 web backend": [("Azure", "reserved", "D4s_v3", 111.80, None), ("AWS", "reserved", "m5.xlarge", 118.51, 6.0),
                       ("GCP", "reserved", "n2-standard-4", 123.31, 10.3)],
    "W2 batch": [("GCP", "spot", "n2-standard-8", 40.10, None), ("AWS", "spot", "m5.2xlarge", 40.78, 1.7),
                 ("Azure", "spot", "D8s_v3", 43.43, 8.3)],
    "W3 ML training": [("GCP", "spot", "n1-standard-4+T4", 38.54, None), ("AWS", "spot", "g4dn.xlarge", 46.83, 21.5),
                       ("Azure", "spot", "NC4as_T4_v3", 53.21, 38.1)],
    "W4 analytics DB": [("Azure", "reserved", "D8s_v3", 220.00, None), ("AWS", "reserved", "m5.2xlarge", 234.01, 6.4),
                        ("GCP", "reserved", "n2-standard-8", 240.67, 9.4)],
    "W5 dev/test": [("AWS", "spot", "m5.large", 8.28, None), ("GCP", "spot", "n2-standard-2", 8.55, 3.3),
                    ("Azure", "spot", "D2s_v3", 8.63, 4.3)],
}
# report Table 6.4: compute, storage, egress, cheapest on-demand, saving %
ITEMISED = {"W1 web backend": (86.90, 7.50, 17.40, 165.06, 32.3), "W2 batch": (14.10, 20.00, 6.00, 76.95, 47.9),
            "W3 ML training": (26.14, 10.00, 2.40, 114.44, 66.3), "W4 analytics DB": (173.80, 37.50, 8.70, 326.52, 32.6),
            "W5 dev/test": (3.38, 4.00, 0.90, 14.22, 41.8)}


@pytest.mark.parametrize("key", list(EXPECTED))
def test_top_three_matches_report_table_6_3(prices, key):
    recs = run(prices, key)["recommendations"]
    assert [(r["provider"], r["pricing_model"], r["instance_type"], r["total_monthly_cost"]) for r in recs] == \
           [e[:4] for e in EXPECTED[key]]
    for r, e in zip(recs[1:], EXPECTED[key][1:]):
        assert r["explanation"]["delta_vs_best_pct"] == pytest.approx(e[4], abs=0.06)


@pytest.mark.parametrize("key", list(ITEMISED))
def test_itemised_cost_and_saving_match_report_table_6_4(prices, key):
    best = run(prices, key)["recommendations"][0]
    comp, stor, egr, od, sav = ITEMISED[key]
    assert (best["compute_cost"], best["storage_cost"], best["egress_cost"]) == (comp, stor, egr)
    s = best["savings"]["cheapest_on_demand"]
    assert s["baseline_cost"] == od and s["percent"] == pytest.approx(sav, abs=0.06)


@pytest.mark.parametrize("key", list(EXPECTED))
def test_it02_components_sum_to_total(prices, key):
    for r in run(prices, key)["recommendations"]:
        assert round(r["compute_cost"] + r["storage_cost"] + r["egress_cost"], 2) == pytest.approx(r["total_monthly_cost"], abs=0.011)


def test_eligibility_per_workload(prices):
    """Spot only for W2/W3/W5, reserved only for W1/W4 (Report 6.2.2)."""
    for key, d in REFERENCE_WORKLOADS.items():
        models = {c["pricing_model"] for c in run(prices, key)["candidates"]}
        assert ("spot" in models) == d["tol"]
        assert ("reserved" in models) == (d["usage_pattern"] == "steady-state" and d["h"] >= 500)


def test_ut05_w2_aws_spot_is_40_78(prices):
    aws = [c for c in run(prices, "W2 batch")["candidates"] if c["provider"] == "AWS" and c["pricing_model"] == "spot"][0]
    assert aws["total_monthly_cost"] == 40.78 and aws["compute_cost"] == 20.28


def test_w2_top_two_effectively_tied(prices):
    e = run(prices, "W2 batch")["recommendations"][0]["explanation"]
    assert e["effectively_tied"] and "effectively tied" in e["summary"]


def test_it01_gpu_workload_gets_gpu_instances_from_all_providers(prices):
    cands = run(prices, "W3 ML training")["candidates"]
    assert {c["provider"] for c in cands} == {"AWS", "Azure", "GCP"} and all(c["gpu_count"] >= 1 for c in cands)


def test_fr_cst_07_changed_rate_changes_cost(prices):
    from dataclasses import replace
    base = run(prices, "W2 batch")["recommendations"][0]["total_monthly_cost"]
    bumped = [replace(r, price_per_hour=r.price_per_hour * 2) if r.provider == "GCP" else r for r in prices]
    res = recommend(make_workload(REFERENCE_WORKLOADS["W2 batch"]), bumped)
    assert res["recommendations"][0]["provider"] == "AWS" and res["recommendations"][0]["total_monthly_cost"] != base


def test_nfr04_same_profile_same_snapshot_same_output(prices):
    a, b = run(prices, "W4 analytics DB"), run(prices, "W4 analytics DB")
    assert a == b


def test_explanation_has_all_six_components(prices):
    e = run(prices, "W1 web backend")["recommendations"][0]
    ex = e["explanation"]
    assert e["compute_cost"] and ex["delta_vs_best_pct"] == 0 and e["savings"]["cheapest_on_demand"]["percent"]
    assert ex["dominant_driver"]["component"] == "compute" and ex["eligibility_reason"].startswith("Eligible because")
    assert ex["warnings"] and ex["tradeoffs"] is not None  # caveats (reserved commitment) present
