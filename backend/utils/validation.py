"""Workload validation. Raises ValidationError(field, message); the API maps it to HTTP 400.

Documented behaviour for TC-W12: gpu_required=false with a gpu_type is REJECTED (400).
Extra rule: usage_pattern 'gpu-intensive' requires gpu_required=true.
"""
from decimal import Decimal, InvalidOperation

from backend.utils.constants import DEFAULT_RUNTIME_HOURS, MAX_RUNTIME_HOURS, STORAGE_TYPES, USAGE_PATTERNS


class ValidationError(Exception):
    def __init__(self, field, message):
        super().__init__(message)
        self.field = field
        self.message = message

    def to_dict(self):
        return {"error": "validation_error", "message": self.message, "field": self.field}


def _number(data, field, label):
    if field not in data or data[field] is None:
        raise ValidationError(field, f"{label} is required")
    v = data[field]
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise ValidationError(field, f"{label} must be a number")
    try:
        d = Decimal(str(v))
    except InvalidOperation:
        raise ValidationError(field, f"{label} must be a number")
    if not d.is_finite():
        raise ValidationError(field, f"{label} must be a finite number")
    return v


def _bool(data, field, label):
    if field not in data or data[field] is None:
        raise ValidationError(field, f"{label} is required")
    if not isinstance(data[field], bool):
        raise ValidationError(field, f"{label} must be true or false")
    return data[field]


def validate_workload(data):
    """Return a normalised workload dict, or raise ValidationError."""
    if not isinstance(data, dict):
        raise ValidationError("body", "Request body must be a JSON object")

    out = {}
    out["vcpu"] = _number(data, "vcpu", "vCPU")
    if out["vcpu"] <= 0:
        raise ValidationError("vcpu", "vCPU must be greater than 0")
    out["ram_gb"] = _number(data, "ram_gb", "RAM")
    if out["ram_gb"] <= 0:
        raise ValidationError("ram_gb", "RAM must be greater than 0")
    out["storage_gb"] = _number(data, "storage_gb", "Storage")
    if out["storage_gb"] < 0:
        raise ValidationError("storage_gb", "Storage must be 0 or more")

    st = data.get("storage_type")
    if st not in STORAGE_TYPES:
        raise ValidationError("storage_type", f"Storage type must be one of {', '.join(STORAGE_TYPES)}")
    out["storage_type"] = st

    out["monthly_data_transfer_in_gb"] = _number(data, "monthly_data_transfer_in_gb", "Inbound transfer")
    if out["monthly_data_transfer_in_gb"] < 0:
        raise ValidationError("monthly_data_transfer_in_gb", "Inbound transfer must be 0 or more")
    out["monthly_data_transfer_out_gb"] = _number(data, "monthly_data_transfer_out_gb", "Outbound transfer")
    if out["monthly_data_transfer_out_gb"] < 0:
        raise ValidationError("monthly_data_transfer_out_gb", "Outbound transfer must be 0 or more")

    up = data.get("usage_pattern")
    if up not in USAGE_PATTERNS:
        raise ValidationError("usage_pattern", f"Usage pattern must be one of {', '.join(USAGE_PATTERNS)}")
    out["usage_pattern"] = up

    out["gpu_required"] = _bool(data, "gpu_required", "GPU required")
    gt = data.get("gpu_type")
    if out["gpu_required"]:
        if not isinstance(gt, str) or not gt.strip():
            raise ValidationError("gpu_type", "GPU type is required when GPU is required")
        out["gpu_type"] = gt.strip()
    else:
        if gt is not None:
            raise ValidationError("gpu_type", "GPU type must be null when GPU is not required")
        out["gpu_type"] = None
    if up == "gpu-intensive" and not out["gpu_required"]:
        raise ValidationError("gpu_required", "A gpu-intensive workload requires a GPU")

    if data.get("expected_runtime_hours_per_month") is None:
        out["expected_runtime_hours_per_month"] = DEFAULT_RUNTIME_HOURS
    else:
        out["expected_runtime_hours_per_month"] = _number(
            data, "expected_runtime_hours_per_month", "Runtime")
    rt = out["expected_runtime_hours_per_month"]
    if rt <= 0:
        raise ValidationError("expected_runtime_hours_per_month", "Runtime must be greater than 0")
    if rt > MAX_RUNTIME_HOURS:
        raise ValidationError("expected_runtime_hours_per_month",
                              f"Runtime must be at most {MAX_RUNTIME_HOURS} hours per month")

    out["interruption_tolerant"] = _bool(data, "interruption_tolerant", "Interruption tolerance")

    region = data.get("preferred_region", "any")
    if region is None:
        region = "any"
    if not isinstance(region, str) or not region.strip():
        raise ValidationError("preferred_region", "Preferred region must be 'any' or a region name")
    out["preferred_region"] = region.strip()
    return out
