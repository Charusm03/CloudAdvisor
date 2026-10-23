"""Itemised monthly cost. Decimal throughout; nothing is rounded here (round only for display).

compute  on_demand: price * runtime
         spot:      price * runtime * (1 + spot_rerun_overhead)
         reserved:  price * max(runtime, hours_per_month)   (committed capacity is billed all month)
storage  storage_gb * storage_price_per_gb_month
egress   out_gb * egress_price_per_gb
ingress  in_gb  * ingress_price_per_gb
"""
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from backend.config import DEFAULT_COST_CONFIG

CENT = Decimal("0.01")


def money(d):
    return d.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class CostBreakdown:
    compute: Decimal
    storage: Decimal
    egress: Decimal
    ingress: Decimal
    billed_hours: Decimal

    @property
    def total(self):
        return self.compute + self.storage + self.egress + self.ingress


def compute_cost(w, rec, cfg=DEFAULT_COST_CONFIG):
    runtime = w.expected_runtime_hours_per_month
    if rec.pricing_model == "on_demand":
        hours = runtime
    elif rec.pricing_model == "spot":
        hours = runtime * (1 + cfg.spot_rerun_overhead)
    elif rec.pricing_model == "reserved":
        hours = max(runtime, cfg.hours_per_month) if cfg.reserved_billed_full_month else runtime
    else:
        raise ValueError(f"unknown pricing model {rec.pricing_model}")
    return CostBreakdown(
        compute=rec.price_per_hour * hours,
        storage=w.storage_gb * rec.storage_price_per_gb_month,
        egress=w.monthly_data_transfer_out_gb * rec.egress_price_per_gb,
        ingress=w.monthly_data_transfer_in_gb * rec.ingress_price_per_gb,
        billed_hours=hours)
