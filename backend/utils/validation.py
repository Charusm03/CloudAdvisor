"""Workload validation. Collects EVERY field error (Requirement FR-INT-07) and raises ValidationError.

ValidationError exposes the first problem as `field`/`message` (backwards compatible) plus the complete
list as `errors` = [{"field":..., "message":...}, ...]; the API maps it to HTTP 400.

Rules (Requirement Table 4.1): vCPU positive integer; RAM > 0; GPU count >= 0 (>= 1 when a GPU is required);
storage / transfer >= 0; runtime in (0, 730]; usage pattern from a fixed list; interruption tolerance boolean.
Documented behaviour for TC-W12: gpu_required=false with a gpu_type is REJECTED.
Extra rule: usage_pattern 'gpu-intensive' requires gpu_required=true.
"""
from decimal import Decimal, InvalidOperation

from backend.utils.constants import (DEFAULT_RUNTIME_HOURS, MAX_RUNTIME_HOURS, REGION_GROUPS, STORAGE_TYPES,
                                     USAGE_PATTERNS)


class ValidationError(Exception):
    def __init__(self, field, message, errors=None):
        super().__init__(message)
        self.field = field
        self.message = message
        self.errors = errors or [{"field": field, "message": message}]

    def to_dict(self):
        return {"error": "validation_error", "message": self.message, "field": self.field, "errors": self.errors}


class _Collector:
    def __init__(self):
        self.errors = []

    def add(self, field, message):
        if not any(e["field"] == field for e in self.errors):
            self.errors.append({"field": field, "message": message})

    def raise_if_any(self):
        if self.errors:
            first = self.errors[0]
            raise ValidationError(first["field"], first["message"], self.errors)


def _number(data, field, label, c):
    """Return the numeric value, or None after recording an error."""
    if field not in data or data[field] is None:
        c.add(field, f"{label} is required")
        return None
    v = data[field]
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        c.add(field, f"{label} must be a number")
        return None
    try:
        d = Decimal(str(v))
    except InvalidOperation:
        c.add(field, f"{label} must be a number")
        return None
    if not d.is_finite():
        c.add(field, f"{label} must be a finite number")
        return None
    return v


def _bool(data, field, label, c):
    if field not in data or data[field] is None:
        c.add(field, f"{label} is required")
        return None
    if not isinstance(data[field], bool):
        c.add(field, f"{label} must be true or false")
        return None
    return data[field]


def valid_region_choice(value):
    return value == "any" or value in REGION_GROUPS or (isinstance(value, str) and bool(value.strip()))


def validate_workload(data):
    """Return a normalised workload dict, or raise ValidationError listing all problems."""
    if not isinstance(data, dict):
        raise ValidationError("body", "Request body must be a JSON object")
    c, out = _Collector(), {}

    v = _number(data, "vcpu", "vCPU", c)
    if v is not None:
        if v <= 0:
            c.add("vcpu", "vCPU must be greater than 0")
        elif float(v) != int(v):
            c.add("vcpu", "vCPU must be a whole number")
        else:
            out["vcpu"] = int(v)
    v = _number(data, "ram_gb", "RAM", c)
    if v is not None:
        if v <= 0:
            c.add("ram_gb", "RAM must be greater than 0")
        else:
            out["ram_gb"] = v
    for f, label in (("storage_gb", "Storage"), ("monthly_data_transfer_in_gb", "Inbound transfer"),
                     ("monthly_data_transfer_out_gb", "Outbound transfer")):
        v = _number(data, f, label, c)
        if v is not None:
            if v < 0:
                c.add(f, f"{label} must be 0 or more")
            else:
                out[f] = v

    st = data.get("storage_type")
    if st not in STORAGE_TYPES:
        c.add("storage_type", f"Storage type must be one of {', '.join(STORAGE_TYPES)}")
    else:
        out["storage_type"] = st

    up = data.get("usage_pattern")
    if up not in USAGE_PATTERNS:
        c.add("usage_pattern", f"Usage pattern must be one of {', '.join(USAGE_PATTERNS)}")
    else:
        out["usage_pattern"] = up

    gpu_required = _bool(data, "gpu_required", "GPU required", c)
    out["gpu_required"] = gpu_required
    gt, gc = data.get("gpu_type"), data.get("gpu_count")
    if gpu_required:
        if not isinstance(gt, str) or not gt.strip():
            c.add("gpu_type", "GPU type is required when GPU is required")
        else:
            out["gpu_type"] = gt.strip()
        if gc is None:
            out["gpu_count"] = 1
        elif isinstance(gc, bool) or not isinstance(gc, (int, float)) or float(gc) != int(gc):
            c.add("gpu_count", "GPU count must be a whole number")
        elif gc < 1:
            c.add("gpu_count", "GPU count must be at least 1 when a GPU is required")
        else:
            out["gpu_count"] = int(gc)
    elif gpu_required is False:
        if gt is not None:
            c.add("gpu_type", "GPU type must be null when GPU is not required")
        if gc not in (None, 0):
            c.add("gpu_count", "GPU count must be 0 when GPU is not required")
        out["gpu_type"], out["gpu_count"] = None, 0
    if up == "gpu-intensive" and gpu_required is False:
        c.add("gpu_required", "A gpu-intensive workload requires a GPU")

    if data.get("expected_runtime_hours_per_month") is None:
        out["expected_runtime_hours_per_month"] = DEFAULT_RUNTIME_HOURS
    else:
        rt = _number(data, "expected_runtime_hours_per_month", "Runtime", c)
        if rt is not None:
            if rt <= 0:
                c.add("expected_runtime_hours_per_month", "Runtime must be greater than 0")
            elif rt > MAX_RUNTIME_HOURS:
                c.add("expected_runtime_hours_per_month",
                      f"Runtime must be at most {MAX_RUNTIME_HOURS} hours per month")
            else:
                out["expected_runtime_hours_per_month"] = rt

    tol = _bool(data, "interruption_tolerant", "Interruption tolerance", c)
    out["interruption_tolerant"] = tol

    region = data.get("preferred_region", "any")
    if region is None:
        region = "any"
    if not isinstance(region, str) or not region.strip():
        c.add("preferred_region", "Preferred region must be 'any', a region group or a region name")
    else:
        out["preferred_region"] = region.strip()

    c.raise_if_any()
    return out
