"""Candidate generation: technical compatibility, pricing-model eligibility, smallest-fit selection,
and the resource-fit calculation.

Pipeline (Requirement FR-CST-01/02/05/06):
  1. is_compatible      - hard technical constraints (vCPU, RAM, GPU, storage type, region)
  2. is_model_eligible  - on-demand always; spot only if interruption tolerant;
                          reserved only for steady-state workloads running >= RESERVED_MIN_HOURS
  3. smallest fit       - for every (provider, region, pricing model) keep only the smallest fitting
                          instance (ties broken by price), so a one-region request yields <= 9 candidates.
"""
from dataclasses import dataclass
from decimal import Decimal

from backend.utils.constants import REGION_GROUPS, RESERVED_MIN_HOURS


@dataclass(frozen=True)
class Fit:
    cpu_surplus: Decimal
    ram_surplus: Decimal
    cpu_utilization: Decimal
    ram_utilization: Decimal
    score: Decimal  # (cpu_fit + ram_fit) / 2, in (0, 1]


def region_matches(w, rec):
    """preferred_region may be 'any', a region group key ('us', 'europe') or an exact region name."""
    pr = w.preferred_region
    if pr == "any":
        return True
    if pr in REGION_GROUPS:
        return rec.region in REGION_GROUPS[pr]["regions"].get(rec.provider, [])
    return rec.region == pr


def is_compatible(w, rec):
    """Hard technical constraints: a candidate failing any of these is never recommended.

    GPU instances are excluded for workloads that do not need a GPU (paying for an idle GPU is waste)."""
    if rec.vcpu < w.vcpu or rec.ram_gb < w.ram_gb:
        return False
    if w.gpu_required:
        if rec.gpu_type != w.gpu_type or rec.gpu_count < max(w.gpu_count, 1):
            return False
    elif rec.gpu_count > 0:
        return False
    if w.storage_type not in rec.storage_types:
        return False
    return region_matches(w, rec)


def reserved_eligible(w):
    return w.usage_pattern == "steady-state" and w.expected_runtime_hours_per_month >= RESERVED_MIN_HOURS


def is_model_eligible(w, model):
    if model == "on_demand":
        return True
    if model == "spot":
        return w.interruption_tolerant
    if model == "reserved":
        return reserved_eligible(w)
    return False


def eligibility_reason(w, model):
    if model == "on_demand":
        return "On-demand is always eligible: no commitment and no interruption."
    if model == "spot":
        return "Eligible because the workload tolerates interruption."
    return (f"Eligible because the workload is steady-state and runs "
            f"{w.expected_runtime_hours_per_month.normalize():f} h/month (at least {RESERVED_MIN_HOURS} h).")


def _size_key(rec):
    return (rec.vcpu, rec.ram_gb, rec.gpu_count, rec.price_per_hour, rec.instance_type)


def find_candidates(w, records):
    """Eligible, smallest-fitting candidate per (provider, region, pricing model)."""
    best = {}
    for r in records:
        if not is_model_eligible(w, r.pricing_model) or not is_compatible(w, r):
            continue
        key = (r.provider, r.region, r.pricing_model)
        if key not in best or _size_key(r) < _size_key(best[key]):
            best[key] = r
    return sorted(best.values(), key=lambda r: (r.provider, r.region, r.pricing_model))


def resource_fit(w, rec):
    cpu = w.vcpu / rec.vcpu
    ram = w.ram_gb / rec.ram_gb
    return Fit(rec.vcpu - w.vcpu, rec.ram_gb - w.ram_gb, cpu, ram, (cpu + ram) / 2)
