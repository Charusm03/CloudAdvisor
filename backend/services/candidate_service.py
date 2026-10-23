"""Candidate matching + resource-fit calculation."""
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Fit:
    cpu_surplus: Decimal
    ram_surplus: Decimal
    cpu_utilization: Decimal
    ram_utilization: Decimal
    score: Decimal  # (cpu_fit + ram_fit) / 2, in (0, 1]


def is_compatible(w, rec):
    """Hard technical constraints: a candidate failing any of these is never recommended.

    GPU instances are excluded for workloads that do not need a GPU (paying for an idle GPU is waste)."""
    if rec.vcpu < w.vcpu or rec.ram_gb < w.ram_gb:
        return False
    if w.gpu_required:
        if rec.gpu_type != w.gpu_type or rec.gpu_count < 1:
            return False
    elif rec.gpu_count > 0:
        return False
    if w.storage_type not in rec.storage_types:
        return False
    if w.preferred_region != "any" and rec.region != w.preferred_region:
        return False
    return True


def find_candidates(w, records):
    return [r for r in records if is_compatible(w, r)]


def resource_fit(w, rec):
    cpu = w.vcpu / rec.vcpu
    ram = w.ram_gb / rec.ram_gb
    return Fit(rec.vcpu - w.vcpu, rec.ram_gb - w.ram_gb, cpu, ram, (cpu + ram) / 2)
