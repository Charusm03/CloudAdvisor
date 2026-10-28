from decimal import Decimal as D

import pytest

from backend.services.recommendation_engine import NoCompatibleCandidates, compute_baselines, rank_candidates, recommend, savings
from backend.services.candidate_service import find_candidates
from backend.tests.helpers import rec, wl


def top(w, recs, n=3):
    return recommend(w, recs, top_n=n)["recommendations"]


def test_p01_on_demand_accepted():
    assert top(wl(), [rec()])[0]["pricing_model"] == "on_demand"


def test_p02_spot_competes_when_tolerant():
    w = wl(interruption_tolerant=True)
    out = top(w, [rec(), rec(model="spot", price="0.03", risk="medium")])
    assert out[0]["pricing_model"] == "spot"


def test_p03_p_r03_spot_never_generated_when_not_tolerant():
    w = wl(interruption_tolerant=False)
    recs = [rec(instance="od", price="0.50"), rec(instance="sp", model="spot", price="0.01", risk="low")]
    res = recommend(w, recs)
    assert [c["pricing_model"] for c in res["candidates"]] == ["on_demand"]  # spot is absent, not merely ranked last


def test_p04_reserved_preferred_for_steady_when_cheaper():
    w = wl(usage_pattern="steady-state", expected_runtime_hours_per_month=730)
    out = top(w, [rec(), rec(model="reserved", price="0.07", commit=12)])
    assert out[0]["pricing_model"] == "reserved"


def test_p05_r08_reserved_not_generated_for_bursty():
    # reserved is ~10% cheaper on paper but a bursty workload is not eligible for a commitment
    w = wl(usage_pattern="bursty", expected_runtime_hours_per_month=730, storage_gb=0,
           monthly_data_transfer_out_gb=0, monthly_data_transfer_in_gb=0)
    res = recommend(w, [rec(price="0.10"), rec(model="reserved", price="0.09", commit=12)])
    assert [c["pricing_model"] for c in res["candidates"]] == ["on_demand"]


def test_p06_batch_tolerant_spot_ranks_highly():
    w = wl(usage_pattern="batch/scheduled", interruption_tolerant=True)
    out = top(w, [rec(), rec(model="spot", price="0.03", risk="medium"), rec(model="reserved", price="0.07", commit=12)])
    assert out[0]["pricing_model"] == "spot"


def test_r01_cheapest_valid_ranks_first_with_equal_fit():
    out = top(wl(), [rec(provider="AWS", instance="a", price="0.30"), rec(provider="Azure", instance="b", price="0.10"),
                     rec(provider="GCP", instance="c", price="0.20")])
    assert [x["instance_type"] for x in out] == ["b", "c", "a"]


def test_r02_incompatible_never_ranks_first():
    out = top(wl(vcpu=4, ram_gb=16), [rec(instance="tiny", vcpu=2, ram=4, price="0.001"), rec(instance="ok", vcpu=4, ram=16)])
    assert [x["instance_type"] for x in out] == ["ok"]


def test_r04_gpu_workload_never_cpu_only():
    w = wl(vcpu=4, ram_gb=16, gpu_required=True, gpu_type="NVIDIA T4", usage_pattern="gpu-intensive")
    out = top(w, [rec(instance="cpu", vcpu=4, ram=16, price="0.01"), rec(instance="gpu", vcpu=4, ram=16, gpu="NVIDIA T4", gpu_count=1, price="0.5")])
    assert [x["instance_type"] for x in out] == ["gpu"]


def test_r05_high_egress_provider_b_wins():
    """Provider A: compute 50 + egress 100 = 150; Provider B: compute 70 + egress 10 = 80 -> B wins."""
    w = wl(storage_gb=0, monthly_data_transfer_in_gb=0, monthly_data_transfer_out_gb=1000,
           expected_runtime_hours_per_month=500)
    a = rec(provider="AWS", instance="A", price="0.10", egress="0.10")
    b = rec(provider="GCP", instance="B", price="0.14", egress="0.01")
    res = recommend(w, [a, b])
    r1, r2 = res["recommendations"]
    assert (r1["instance_type"], r1["total_monthly_cost"]) == ("B", 80.0)
    assert (r2["instance_type"], r2["total_monthly_cost"]) == ("A", 150.0)
    assert "egress" in " ".join(r1["explanation"]["reasons"] + r1["explanation"]["tradeoffs"]).lower()
    assert any("Although AWS A" in t and "egress" in t for t in r1["explanation"]["tradeoffs"])


def test_r06_low_egress_compute_dominates():
    w = wl(storage_gb=0, monthly_data_transfer_in_gb=0, monthly_data_transfer_out_gb=0, expected_runtime_hours_per_month=500)
    a = rec(provider="AWS", instance="A", price="0.10", egress="0.50")
    b = rec(provider="GCP", instance="B", price="0.14", egress="0.01")
    assert top(w, [a, b])[0]["instance_type"] == "A"


def test_r07_steady_reserved_can_rank_highly():
    w = wl(usage_pattern="steady-state", expected_runtime_hours_per_month=730)
    out = top(w, [rec(instance="od"), rec(instance="res", model="reserved", price="0.065", commit=12)])
    assert out[0]["instance_type"] == "res"


def test_r09_no_candidates():
    with pytest.raises(NoCompatibleCandidates):
        recommend(wl(vcpu=500), [rec()])


def test_r10_one_candidate_r11_two_candidates_r12_many():
    assert [x["rank"] for x in top(wl(), [rec()])] == [1]
    assert len(top(wl(), [rec(provider="AWS", instance="a"), rec(provider="GCP", instance="b")])) == 2
    regions = [f"r{i}" for i in range(6)]
    assert len(top(wl(), [rec(region=r, instance=r, price=f"0.{10 + i}") for i, r in enumerate(regions)])) == 3


def test_baselines_and_savings():
    recs = [rec(provider="AWS", price="0.30"), rec(provider="Azure", price="0.20"), rec(provider="GCP", price="0.25")]
    b = compute_baselines(rank_candidates(wl(), find_candidates(wl(), recs)))
    assert {k: v.rec.provider for k, v in b.items()} == {
        "aws_on_demand": "AWS", "azure_on_demand": "Azure", "gcp_on_demand": "GCP", "cheapest_on_demand": "Azure"}
    amount, pct = savings(D("200"), D("150"))
    assert (amount, pct) == (50, 25)
    assert savings(D("100"), D("120"))[0] == -20  # more expensive than baseline -> negative saving
    assert savings(D("0"), D("5"))[1] is None


def test_baseline_missing_provider_is_null_and_reliability_note():
    w = wl(interruption_tolerant=True, usage_pattern="batch/scheduled")
    res = recommend(w, [rec(provider="AWS", price="0.30"), rec(provider="AWS", model="spot", price="0.05", risk="medium")])
    s = res["recommendations"][0]["savings"]
    assert s["azure_on_demand"] is None and s["gcp_on_demand"] is None
    assert s["aws_on_demand"]["amount"] > 0 and "interruption" in s["aws_on_demand"]["reliability_note"]


def test_explanations_are_specific_and_traceable():
    res = recommend(wl(), [rec(provider="AWS", instance="cheap", price="0.10"), rec(provider="GCP", instance="dear", price="0.20")])
    e = res["recommendations"][0]["explanation"]
    text = " ".join([e["summary"]] + e["reasons"])
    for needle in ("cheap", "vCPU", "RAM", "fit", "On-Demand", "Interruption risk", "$"):
        assert needle in text
    assert "lower than the next-best" in e["summary"]
    assert "more than the top-ranked" in res["recommendations"][1]["explanation"]["summary"]


def test_effectively_tied_is_reported():
    res = recommend(wl(), [rec(provider="AWS", instance="a", price="0.1000"), rec(provider="GCP", instance="b", price="0.1001")])
    assert "effectively tied" in res["recommendations"][0]["explanation"]["summary"]


def test_assumptions_and_snapshot_present():
    res = recommend(wl(), [rec()])
    assert res["pricing_snapshot_date"] == "2026-10-19"
    assert any("Pricing snapshot" in a for a in res["assumptions"]) and any("USD" in a for a in res["assumptions"])
