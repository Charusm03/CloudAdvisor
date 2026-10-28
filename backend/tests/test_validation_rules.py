import pytest

from backend.tests.helpers import BASE_WORKLOAD
from backend.utils.validation import ValidationError, validate_workload


def check(**kw):
    return validate_workload({**BASE_WORKLOAD, **kw})


def test_all_field_errors_returned_at_once():
    with pytest.raises(ValidationError) as ei:
        validate_workload({"vcpu": -1, "ram_gb": 0, "storage_gb": -5, "storage_type": "tape", "usage_pattern": "x",
                           "gpu_required": "maybe", "interruption_tolerant": None,
                           "monthly_data_transfer_in_gb": 0, "monthly_data_transfer_out_gb": -1})
    fields = {e["field"] for e in ei.value.errors}
    assert {"vcpu", "ram_gb", "storage_gb", "storage_type", "usage_pattern", "gpu_required",
            "interruption_tolerant", "monthly_data_transfer_out_gb"} <= fields
    assert ei.value.field == ei.value.errors[0]["field"]  # backwards-compatible first error


def test_vcpu_must_be_whole_number():
    with pytest.raises(ValidationError) as ei:
        check(vcpu=2.5)
    assert ei.value.field == "vcpu"
    assert check(vcpu=4.0)["vcpu"] == 4


@pytest.mark.parametrize("hours,ok", [(0, False), (0.5, True), (730, True), (730.5, False), (744, False), (800, False)])
def test_runtime_cap_is_730(hours, ok):
    if ok:
        assert check(expected_runtime_hours_per_month=hours)["expected_runtime_hours_per_month"] == hours
    else:
        with pytest.raises(ValidationError):
            check(expected_runtime_hours_per_month=hours)


def test_gpu_count_rules():
    gpu = dict(gpu_required=True, gpu_type="NVIDIA T4", usage_pattern="gpu-intensive")
    assert check(**gpu)["gpu_count"] == 1                       # defaults to 1
    assert check(**gpu, gpu_count=4)["gpu_count"] == 4
    for bad in (0, -1, 1.5, True):
        with pytest.raises(ValidationError):
            check(**gpu, gpu_count=bad)
    with pytest.raises(ValidationError):
        check(gpu_count=2)                                      # GPU not required but a count was supplied
    assert check()["gpu_count"] == 0


def test_api_returns_errors_list(client, payload):
    r = client.post("/api/recommendations/preview", json={**payload, "vcpu": 2.5, "ram_gb": -1})
    body = r.get_json()
    assert r.status_code == 400 and {e["field"] for e in body["errors"]} == {"vcpu", "ram_gb"}


def test_workload_persists_gpu_count(client, payload):
    r = client.post("/api/workloads", json={**payload, "gpu_required": True, "gpu_type": "NVIDIA T4",
                                            "gpu_count": 2, "usage_pattern": "gpu-intensive"})
    assert r.status_code == 201 and r.get_json()["gpu_count"] == 2
