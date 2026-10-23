"""Pricing data access. PricingProvider is the extension point for live APIs (future work)."""
import csv
from abc import ABC, abstractmethod
from decimal import Decimal, InvalidOperation

from sqlalchemy import select

from backend.models.pricing import PricingRecord, PricingRow
from backend.utils.constants import INTERRUPTION_RISKS, PRICING_MODELS, PROVIDERS


class PricingProvider(ABC):
    @abstractmethod
    def get_prices(self):
        """Return a list[PricingRow]."""


class StaticPricingProvider(PricingProvider):
    """Reads the manually curated CSV snapshot. Future: AWS/Azure/GCPPricingProvider."""

    def __init__(self, csv_path):
        self.csv_path = csv_path

    def get_prices(self):
        rows = []
        with open(self.csv_path, newline="") as f:
            for i, r in enumerate(csv.DictReader(f), start=2):
                try:
                    row = PricingRow(
                        provider=r["provider"], region=r["region"], instance_type=r["instance_type"],
                        vcpu=Decimal(r["vcpu"]), ram_gb=Decimal(r["ram_gb"]),
                        gpu_type=r["gpu_type"] or None, gpu_count=int(r["gpu_count"] or 0),
                        storage_types=tuple(r["storage_type_supported"].split("|")),
                        pricing_model=r["pricing_model"], price_per_hour=Decimal(r["price_per_hour"]),
                        storage_price_per_gb_month=Decimal(r["storage_price_per_gb_month"]),
                        egress_price_per_gb=Decimal(r["egress_price_per_gb"]),
                        ingress_price_per_gb=Decimal(r["ingress_price_per_gb"]),
                        interruption_risk=r["interruption_risk"], commitment_months=int(r["commitment_months"]),
                        source=r["source"], price_snapshot_date=r["price_snapshot_date"])
                except (KeyError, ValueError, InvalidOperation) as e:
                    raise ValueError(f"pricing CSV line {i}: {e}")
                if (row.provider not in PROVIDERS or row.pricing_model not in PRICING_MODELS
                        or row.interruption_risk not in INTERRUPTION_RISKS or row.price_per_hour < 0):
                    raise ValueError(f"pricing CSV line {i}: invalid provider/model/risk/price")
                rows.append(row)
        return rows


def query_pricing(session, provider=None, region=None, pricing_model=None, min_vcpu=None, min_ram=None):
    q = select(PricingRecord)
    if provider:
        q = q.where(PricingRecord.provider == provider)
    if region:
        q = q.where(PricingRecord.region == region)
    if pricing_model:
        q = q.where(PricingRecord.pricing_model == pricing_model)
    if min_vcpu is not None:
        q = q.where(PricingRecord.vcpu >= min_vcpu)
    if min_ram is not None:
        q = q.where(PricingRecord.ram_gb >= min_ram)
    q = q.order_by(PricingRecord.provider, PricingRecord.region, PricingRecord.instance_type, PricingRecord.pricing_model)
    return list(session.scalars(q))


def all_rows(session):
    return [r.to_row() for r in session.scalars(select(PricingRecord))]
