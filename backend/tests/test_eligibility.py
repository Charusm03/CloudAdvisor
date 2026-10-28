"""Hard eligibility + smallest-fit candidate generation (Requirement FR-CST-01/02/05/06, AC-03)."""
from decimal import Decimal as D

from backend.services.candidate_service import find_candidates
from backend.services.recommendation_engine import recommend
from backend.tests.helpers import rec, wl
from backend.models.pricing import PricingRow


def triple(provider="AWS", region="us-east-1", instance="x1", vcpu=2, ram=8, price="0.10"):
    return [rec(provider=provider, region=region, instance=instance, vcpu=vcpu, ram=ram, model="on_demand", price=price),
            rec(provider=provider, region=region, instance=instance, vcpu=vcpu, ram=ram, model="spot", price="0.04", risk="medium"),
            rec(provider=provider, region=region, instance=instance, vcpu=vcpu, ram=ram, model="reserved", price="0.07", commit=12)]


def models(w, recs):
    return {c.pricing_model for c in find_candidates(w, recs)}


def test_spot_excluded_when_not_interruption_tolerant():
    assert models(wl(interruption_tolerant=False), triple()) == {"on_demand", "reserved"}


def test_spot_included_when_tolerant():
    assert "spot" in models(wl(interruption_tolerant=True), triple())


def test_reserved_requires_steady_pattern():
    for pattern in ("bursty", "batch/scheduled"):
        assert "reserved" not in models(wl(usage_pattern=pattern, expected_runtime_hours_per_month=730), triple())
    assert "reserved" in models(wl(usage_pattern="steady-state", expected_runtime_hours_per_month=730), triple())


def test_reserved_threshold_is_500_hours_inclusive():
    assert "reserved" not in models(wl(expected_runtime_hours_per_month=499), triple())
    assert "reserved" in models(wl(expected_runtime_hours_per_month=500), triple())


def test_100h_steady_intolerant_probe_from_audit():
    """The audit's probe: steady, 100 h, not tolerant -> on-demand only, ascending cost."""
    w = wl(expected_runtime_hours_per_month=100, interruption_tolerant=False)
    recs = triple("AWS") + triple("Azure", "eastus", price="0.09") + triple("GCP", "us-central1", price="0.11")
    res = recommend(w, recs)
    assert {c["pricing_model"] for c in res["candidates"]} == {"on_demand"}
    totals = [c["total_monthly_cost"] for c in res["candidates"]]
    assert totals == sorted(totals)
    assert res["recommendations"][0]["total_monthly_cost"] == res["cheapest_valid"]["total_monthly_cost"]


def test_candidates_sorted_ascending_by_cost():
    w = wl(interruption_tolerant=True)
    recs = triple("AWS") + triple("Azure", "eastus", price="0.09") + triple("GCP", "us-central1", price="0.20")
    totals = [c["total_monthly_cost"] for c in recommend(w, recs)["candidates"]]
    assert totals == sorted(totals) and len(totals) == 9


def test_at_most_nine_candidates_for_one_region():
    w = wl(interruption_tolerant=True)
    recs = []
    for p, reg in (("AWS", "us-east-1"), ("Azure", "eastus"), ("GCP", "us-central1")):
        for i, (v, r) in enumerate(((2, 8), (4, 16), (8, 32), (16, 64))):
            recs += triple(p, reg, instance=f"{p}-{i}", vcpu=v, ram=r, price=str(0.1 * (i + 1)))
    assert len(find_candidates(w, recs)) == 9


def test_smallest_fitting_instance_selected_per_provider():
    w = wl(vcpu=4, ram_gb=16, interruption_tolerant=False, expected_runtime_hours_per_month=100)
    recs = (triple("AWS", instance="small", vcpu=2, ram=8) + triple("AWS", instance="fit", vcpu=4, ram=16, price="0.2")
            + triple("AWS", instance="big", vcpu=8, ram=32, price="0.05"))
    chosen = {c.instance_type for c in find_candidates(w, recs)}
    assert chosen == {"fit"}  # 'big' is cheaper per hour but not the smallest fit; 'small' does not fit


def test_equal_size_tie_broken_by_price():
    w = wl(expected_runtime_hours_per_month=100)
    recs = [rec(instance="pricey", price="0.30"), rec(instance="cheap", price="0.10")]
    assert [c.instance_type for c in find_candidates(w, recs)] == ["cheap"]


def test_region_group_compares_all_providers_in_one_geography():
    recs = (triple("AWS", "us-east-1") + triple("AWS", "eu-west-1") + triple("Azure", "eastus")
            + triple("Azure", "westeurope") + triple("GCP", "us-central1") + triple("GCP", "europe-west1"))
    us = {(c.provider, c.region) for c in find_candidates(wl(preferred_region="us", interruption_tolerant=True), recs)}
    assert us == {("AWS", "us-east-1"), ("Azure", "eastus"), ("GCP", "us-central1")}
    eu = {c.region for c in find_candidates(wl(preferred_region="europe", interruption_tolerant=True), recs)}
    assert eu == {"eu-west-1", "westeurope", "europe-west1"}
    exact = {c.region for c in find_candidates(wl(preferred_region="eastus", interruption_tolerant=True), recs)}
    assert exact == {"eastus"}


def test_gpu_count_requirement():
    w = wl(gpu_required=True, gpu_type="NVIDIA T4", gpu_count=2, usage_pattern="gpu-intensive")
    one = rec(instance="g1", gpu="NVIDIA T4", gpu_count=1)
    two = rec(instance="g2", gpu="NVIDIA T4", gpu_count=2, price="0.9")
    assert [c.instance_type for c in find_candidates(w, [one, two])] == ["g2"]


def test_weighted_ranking_mode_is_opt_in():
    from dataclasses import replace
    from backend.config import DEFAULT_RANKING_CONFIG
    w = wl(usage_pattern="steady-state", expected_runtime_hours_per_month=730)
    recs = [rec(), rec(model="reserved", price="0.07", commit=12)]
    assert recommend(w, recs)["recommendations"][0]["pricing_model"] == "reserved"  # cheapest (default cost mode)
    res = recommend(w, recs, rank_cfg=replace(DEFAULT_RANKING_CONFIG, mode="weighted"))
    assert len(res["recommendations"]) == 2
