from decimal import Decimal as D

from backend.config import CostConfig
from backend.services.cost_engine import compute_cost, money
from backend.tests.helpers import rec, wl

NO_OVERHEAD = CostConfig(spot_rerun_overhead=D("0"))


def cost(w, r, cfg=NO_OVERHEAD):
    return compute_cost(w, r, cfg)


def test_k01_compute_only():
    c = cost(wl(storage_gb=0, monthly_data_transfer_in_gb=0, monthly_data_transfer_out_gb=0), rec(price="0.10"))
    assert (c.compute, c.storage, c.egress, c.total) == (72, 0, 0, 72)


def test_k02_compute_storage():
    c = cost(wl(storage_gb=100, monthly_data_transfer_out_gb=0, monthly_data_transfer_in_gb=0), rec(price="0.10", storage="0.10"))
    assert (c.compute, c.storage, c.total) == (72, 10, 82)


def test_k03_compute_egress():
    c = cost(wl(storage_gb=0, monthly_data_transfer_out_gb=500, monthly_data_transfer_in_gb=0), rec(price="0.10", egress="0.05"))
    assert (c.egress, c.total) == (25, 97)


def test_k04_all_components_example_from_spec():
    c = cost(wl(storage_gb=100, monthly_data_transfer_out_gb=500, monthly_data_transfer_in_gb=0),
             rec(price="0.10", storage="0.10", egress="0.05"))
    assert (c.compute, c.storage, c.egress, c.ingress, c.total) == (72, 10, 25, 0, 107)


def test_k05_zero_inbound_k06_zero_outbound():
    r = rec(ingress="0.01")
    assert cost(wl(monthly_data_transfer_in_gb=0), r).ingress == 0
    assert cost(wl(monthly_data_transfer_out_gb=0), r).egress == 0
    # inbound transfer is excluded from the total by default (Requirement section 8) ...
    assert cost(wl(monthly_data_transfer_in_gb=100), r).ingress == 0
    # ... and only billed when explicitly enabled
    from dataclasses import replace
    from backend.config import DEFAULT_COST_CONFIG
    assert cost(wl(monthly_data_transfer_in_gb=100), r, replace(DEFAULT_COST_CONFIG, include_ingress=True)).ingress == 1


def test_k07_max_runtime_730():
    assert cost(wl(expected_runtime_hours_per_month=730, storage_gb=0, monthly_data_transfer_out_gb=0,
                   monthly_data_transfer_in_gb=0), rec(price="0.10")).compute == D("73.0")


def test_k08_spot_with_overhead():
    w = wl(expected_runtime_hours_per_month=150, storage_gb=0, monthly_data_transfer_out_gb=0, monthly_data_transfer_in_gb=0)
    c = compute_cost(w, rec(model="spot", price="0.12288"), CostConfig(spot_rerun_overhead=D("0.10")))
    assert money(c.compute) == D("20.28")
    assert cost(w, rec(model="spot", price="0.12288")).compute == D("18.432")  # no overhead


def test_k09_reserved_billed_for_full_month():
    w = wl(expected_runtime_hours_per_month=100, storage_gb=0, monthly_data_transfer_out_gb=0, monthly_data_transfer_in_gb=0)
    r = rec(model="reserved", price="0.10", commit=12)
    assert cost(w, r).compute == D("73.0")
    assert compute_cost(w, r, CostConfig(reserved_billed_full_month=False)).compute == D("10.0")
    assert cost(wl(expected_runtime_hours_per_month=744, storage_gb=0, monthly_data_transfer_out_gb=0,
                   monthly_data_transfer_in_gb=0), r).compute == D("74.4")  # never below runtime


def test_k10_no_intermediate_rounding():
    w = wl(expected_runtime_hours_per_month=100, storage_gb=100, monthly_data_transfer_out_gb=0, monthly_data_transfer_in_gb=0)
    c = cost(w, rec(price="0.24003", storage="0.00403"))
    assert c.compute == D("24.00300") and c.storage == D("0.40300")
    assert money(c.total) == D("24.41")                 # rounded once, at the end
    assert money(c.compute) + money(c.storage) == D("24.40")  # what intermediate rounding would give


def test_report_parity_ut05_w2_aws_spot():
    """Report UT-05: W2 on AWS spot = USD 40.78."""
    w = wl(vcpu=8, ram_gb=32, storage_gb=200, monthly_data_transfer_out_gb=50, monthly_data_transfer_in_gb=0,
           expected_runtime_hours_per_month=150, usage_pattern="batch/scheduled", interruption_tolerant=True)
    r = rec(model="spot", price=str(D("0.384") * D("0.32")), storage="0.080", egress="0.090", vcpu=8, ram=32)
    assert money(compute_cost(w, r).total) == D("40.78")


def test_report_parity_w1_azure_reserved():
    w = wl(vcpu=4, ram_gb=16, storage_gb=100, monthly_data_transfer_out_gb=200, monthly_data_transfer_in_gb=0,
           expected_runtime_hours_per_month=730)
    r = rec(provider="Azure", model="reserved", price=str(D("0.192") * D("0.62")), storage="0.075", egress="0.087", commit=12)
    assert money(compute_cost(w, r).total) == D("111.80")
