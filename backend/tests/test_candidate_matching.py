from backend.services.candidate_service import find_candidates, resource_fit
from backend.tests.helpers import rec, wl


def test_c01_exact_match():
    assert find_candidates(wl(vcpu=2, ram_gb=8), [rec(vcpu=2, ram=8)])


def test_c02_larger_accepted():
    assert find_candidates(wl(vcpu=2, ram_gb=8), [rec(vcpu=8, ram=64)])


def test_c03_insufficient_vcpu():
    assert not find_candidates(wl(vcpu=4, ram_gb=8), [rec(vcpu=2, ram=64)])


def test_c04_insufficient_ram():
    assert not find_candidates(wl(vcpu=2, ram_gb=32), [rec(vcpu=8, ram=16)])


def test_c05_gpu_required_but_none():
    assert not find_candidates(wl(gpu_required=True, gpu_type="NVIDIA T4"), [rec(vcpu=8, ram=32)])


def test_c06_correct_gpu():
    assert find_candidates(wl(gpu_required=True, gpu_type="NVIDIA T4"), [rec(gpu="NVIDIA T4", gpu_count=1)])


def test_c07_wrong_gpu():
    assert not find_candidates(wl(gpu_required=True, gpu_type="NVIDIA T4"), [rec(gpu="NVIDIA A100", gpu_count=1)])


def test_c08_region_filter():
    recs = [rec(region="us-east-1"), rec(region="eu-west-1")]
    out = find_candidates(wl(preferred_region="eu-west-1"), recs)
    assert [r.region for r in out] == ["eu-west-1"]


def test_c09_region_any():
    recs = [rec(region="us-east-1"), rec(region="eu-west-1")]
    assert len(find_candidates(wl(preferred_region="any"), recs)) == 2


def test_c10_none_compatible_via_api(client, payload):
    p = {**payload, "vcpu": 1000, "ram_gb": 10000, "gpu_required": True, "gpu_type": "NVIDIA A100"}
    r = client.post("/api/recommendations/preview", json=p)
    assert r.status_code == 422 and r.get_json()["error"] == "no_compatible_candidates"


def test_non_gpu_workload_excludes_gpu_instances():
    assert not find_candidates(wl(), [rec(gpu="NVIDIA T4", gpu_count=1)])


def test_storage_type_must_be_supported():
    assert not find_candidates(wl(storage_type="HDD"), [rec(storage_types=("SSD",))])


def test_fit_scores():
    f = resource_fit(wl(vcpu=2, ram_gb=8), rec(vcpu=4, ram=16))
    assert (f.cpu_surplus, f.ram_surplus) == (2, 8)
    assert float(f.cpu_utilization) == 0.5 and float(f.score) == 0.5
    assert 0 < resource_fit(wl(vcpu=2, ram_gb=8), rec(vcpu=2, ram=8)).score <= 1
