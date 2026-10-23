"""Scenario tests A-H and the demo workload, run against the real seeded dataset through the API."""
import pytest

BASE = dict(vcpu=2, ram_gb=8, storage_gb=100, storage_type="SSD", monthly_data_transfer_in_gb=0,
            monthly_data_transfer_out_gb=100, usage_pattern="steady-state", gpu_required=False, gpu_type=None,
            expected_runtime_hours_per_month=720, interruption_tolerant=False, preferred_region="any")


def preview(client, **kw):
    return client.post("/api/recommendations/preview", json={**BASE, **kw})


def test_demo_workload(client):
    r = preview(client, vcpu=4, ram_gb=16, storage_gb=200, monthly_data_transfer_in_gb=100,
                monthly_data_transfer_out_gb=1000)
    j = r.get_json()
    assert r.status_code == 200 and len(j["recommendations"]) == 3
    totals = [x["total_monthly_cost"] for x in j["recommendations"]]
    assert j["recommendations"][0]["pricing_model"] != "spot"
    assert j["best_overall"]["rank"] == 1 and j["cheapest_valid"]["total_monthly_cost"] <= min(totals)
    assert set(j["provider_comparison"]) == {"AWS", "Azure", "GCP"} and all(j["provider_comparison"].values())
    for x in j["recommendations"]:
        parts = x["compute_cost"] + x["storage_cost"] + x["egress_cost"] + x["ingress_cost"]
        assert parts == pytest.approx(x["total_monthly_cost"], abs=0.02)


def test_scenario_a_basic_multiple_providers(client):
    j = preview(client, vcpu=2, ram_gb=4).get_json()
    assert {c["provider"] for c in j["candidates"]} == {"AWS", "Azure", "GCP"}
    assert j["recommendations"][0]["pricing_model"] != "spot"


def test_scenario_b_high_memory_rejects_small(client):
    j = preview(client, vcpu=4, ram_gb=32).get_json()
    assert all(c["ram_gb"] >= 32 and c["vcpu"] >= 4 for c in j["candidates"])


def test_scenario_c_gpu_t4_only(client):
    j = preview(client, vcpu=8, ram_gb=32, gpu_required=True, gpu_type="NVIDIA T4", usage_pattern="gpu-intensive").get_json()
    assert j["candidates"] and all(c["gpu_type"] == "NVIDIA T4" for c in j["candidates"])
    assert {c["provider"] for c in j["candidates"]} == {"AWS", "Azure", "GCP"}


def test_scenario_d_high_egress_changes_ranking(client):
    low = preview(client, monthly_data_transfer_out_gb=0).get_json()
    high = preview(client, monthly_data_transfer_out_gb=5000).get_json()
    best = high["recommendations"][0]
    assert best["egress_cost"] > best["compute_cost"]            # egress dominates the bill
    assert "egress" in " ".join(best["explanation"]["reasons"]).lower()
    assert high["recommendations"][0]["provider"] != "GCP"       # GCP has the highest egress rate
    assert low["best_overall"]["total_monthly_cost"] < best["total_monthly_cost"]


def test_scenario_e_batch_spot_ranks_highly(client):
    j = preview(client, vcpu=4, ram_gb=8, usage_pattern="batch/scheduled", interruption_tolerant=True,
                expected_runtime_hours_per_month=100).get_json()
    assert j["recommendations"][0]["pricing_model"] == "spot"


def test_scenario_f_non_interruptible_prefers_on_demand_or_reserved(client):
    j = preview(client, vcpu=4, ram_gb=16, interruption_tolerant=False).get_json()
    assert j["recommendations"][0]["pricing_model"] in ("on_demand", "reserved")
    assert j["recommendations"][0]["spot_not_primary"] is False


def test_scenario_g_bursty_short_runtime_avoids_commitment(client):
    j = preview(client, vcpu=8, ram_gb=16, usage_pattern="bursty", expected_runtime_hours_per_month=200).get_json()
    assert j["recommendations"][0]["pricing_model"] == "on_demand"


def test_scenario_h_impossible_no_crash(client):
    r = preview(client, vcpu=1000, ram_gb=10000, gpu_required=True, gpu_type="NVIDIA A100")
    assert r.status_code == 422 and r.get_json()["error"] == "no_compatible_candidates"


def test_region_filter_through_api(client):
    j = preview(client, preferred_region="eu-west-1").get_json()
    assert {c["region"] for c in j["candidates"]} == {"eu-west-1"}
    assert preview(client, preferred_region="mars-1").status_code == 422


def test_saved_workload_recommendation_flow(client):
    wid = client.post("/api/workloads", json=BASE).get_json()["id"]
    r = client.post("/api/recommendations", json={"workload_id": wid})
    assert r.status_code == 200 and r.get_json()["workload"]["id"] == wid
    assert client.post("/api/recommendations", json={"workload_id": 999}).status_code == 404
    assert client.post("/api/recommendations", json={"workload_id": "x"}).get_json()["field"] == "workload_id"


def test_preview_invalid_is_400_not_500(client):
    r = preview(client, vcpu=-5)
    assert r.status_code == 400 and r.get_json()["error"] == "validation_error"


def test_unknown_route_and_health(client):
    assert client.get("/api/nope").status_code == 404
    assert client.get("/api/health").get_json() == {"status": "ok"}
