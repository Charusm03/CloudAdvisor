import pytest

from backend.utils.validation import ValidationError, validate_workload


def post(client, payload, **changes):
    p = {**payload, **changes}
    return client.post("/api/workloads", json=p)


def test_w01_valid(client, payload):
    r = post(client, payload)
    assert r.status_code == 201 and r.get_json()["id"] == 1
    assert client.get("/api/workloads/1").get_json()["vcpu"] == 2
    assert len(client.get("/api/workloads").get_json()) == 1


@pytest.mark.parametrize("tc,changes,field", [
    ("W02", dict(vcpu=0), "vcpu"), ("W03", dict(vcpu=-1), "vcpu"),
    ("W04", dict(ram_gb=0), "ram_gb"), ("W06", dict(storage_gb=-1), "storage_gb"),
    ("W07", dict(storage_type="NVMe"), "storage_type"),
    ("W08", dict(monthly_data_transfer_in_gb=-1), "monthly_data_transfer_in_gb"),
    ("W09", dict(monthly_data_transfer_out_gb=-1), "monthly_data_transfer_out_gb"),
    ("W10", dict(usage_pattern="random"), "usage_pattern"),
    ("W11", dict(gpu_required=True, gpu_type=None), "gpu_type"),
    ("W12", dict(gpu_required=False, gpu_type="NVIDIA T4"), "gpu_type"),
    ("W13", dict(expected_runtime_hours_per_month=0), "expected_runtime_hours_per_month"),
    ("W14", dict(expected_runtime_hours_per_month=745), "expected_runtime_hours_per_month"),
    ("extra-string-number", dict(vcpu="2"), "vcpu"),
    ("extra-bool-as-number", dict(ram_gb=True), "ram_gb"),
    ("extra-gpu-pattern-without-gpu", dict(usage_pattern="gpu-intensive"), "gpu_required"),
])
def test_invalid_returns_400(client, payload, tc, changes, field):
    r = post(client, payload, **changes)
    body = r.get_json()
    assert r.status_code == 400
    assert body["error"] == "validation_error" and body["field"] == field and body["message"]


def test_w05_zero_storage_valid(client, payload):
    assert post(client, payload, storage_gb=0).status_code == 201


def test_w15_interruption_missing(client, payload):
    del payload["interruption_tolerant"]
    r = client.post("/api/workloads", json=payload)
    assert r.status_code == 400 and r.get_json()["field"] == "interruption_tolerant"


def test_w16_region_any_default_and_max_runtime():
    out = validate_workload({**{"vcpu": 1, "ram_gb": 1, "storage_gb": 0, "storage_type": "HDD",
                                "monthly_data_transfer_in_gb": 0, "monthly_data_transfer_out_gb": 0,
                                "usage_pattern": "bursty", "gpu_required": False,
                                "interruption_tolerant": True, "expected_runtime_hours_per_month": 744}})
    assert out["preferred_region"] == "any" and out["gpu_type"] is None


def test_runtime_defaults_to_720():
    out = validate_workload({"vcpu": 1, "ram_gb": 1, "storage_gb": 0, "storage_type": "SSD",
                             "monthly_data_transfer_in_gb": 0, "monthly_data_transfer_out_gb": 0,
                             "usage_pattern": "bursty", "gpu_required": False, "interruption_tolerant": False})
    assert out["expected_runtime_hours_per_month"] == 720


def test_non_json_and_non_object_bodies(client):
    assert client.post("/api/workloads", data="not json", content_type="application/json").status_code == 400
    with pytest.raises(ValidationError):
        validate_workload([1, 2])


def test_unknown_workload_404(client):
    assert client.get("/api/workloads/999").get_json()["error"] == "not_found"


def test_request_size_limit(client, payload):
    r = client.post("/api/workloads", json={**payload, "junk": "x" * 20000})
    assert r.status_code == 413
