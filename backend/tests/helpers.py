from decimal import Decimal as D

from backend.models.pricing import PricingRow
from backend.models.workload import Workload

BASE_WORKLOAD = dict(
    vcpu=2, ram_gb=8, storage_gb=100, storage_type="SSD", monthly_data_transfer_in_gb=100,
    monthly_data_transfer_out_gb=500, usage_pattern="steady-state", gpu_required=False, gpu_type=None,
    expected_runtime_hours_per_month=720, interruption_tolerant=False, preferred_region="any")


def wl(**kw):
    return Workload.from_dict({**BASE_WORKLOAD, **kw})


def rec(provider="AWS", region="us-east-1", instance="x1", vcpu=2, ram=8, gpu=None, gpu_count=0, model="on_demand",
        price="0.10", storage="0.10", egress="0.05", ingress="0", risk="low", commit=0, storage_types=("SSD", "HDD")):
    return PricingRow(provider, region, instance, D(str(vcpu)), D(str(ram)), gpu, gpu_count, tuple(storage_types),
                      model, D(price), D(storage), D(egress), D(ingress), risk, commit, "fixture", "2026-10-19")
