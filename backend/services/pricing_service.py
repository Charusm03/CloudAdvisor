"""Pricing data access. PricingProvider is the extension point for live APIs (future work)."""
import csv
import logging
from abc import ABC, abstractmethod
from datetime import date
from decimal import Decimal, InvalidOperation

from sqlalchemy import select

from backend.models.pricing import PricingRecord, PricingRow
from backend.utils.constants import INTERRUPTION_RISKS, PRICING_MODELS, PROVIDERS


log = logging.getLogger(__name__)


class PricingProvider(ABC):
    @abstractmethod
    def get_prices(self):
        """Return a list[PricingRow]."""


class StaticPricingProvider(PricingProvider):
    """Reads the manually curated CSV snapshot. Future: AWS/Azure/GCPPricingProvider.

    Bad rows (missing/non-numeric values, unknown provider/model/risk, negative prices) are SKIPPED and logged
    (Requirement FR-PRC-06); the skipped line numbers and reasons are kept in `self.skipped`.
    Pass strict=True to abort on the first bad row instead."""

    def __init__(self, csv_path, strict=False):
        self.csv_path = csv_path
        self.strict = strict
        self.skipped = []  # [(line_number, reason)]

    def _parse(self, r):
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
        date.fromisoformat(row.price_snapshot_date)
        if (row.provider not in PROVIDERS or row.pricing_model not in PRICING_MODELS
                or row.interruption_risk not in INTERRUPTION_RISKS):
            raise ValueError("invalid provider/model/risk")
        nums = (row.vcpu, row.ram_gb, row.price_per_hour, row.storage_price_per_gb_month,
                row.egress_price_per_gb, row.ingress_price_per_gb)
        if any((not n.is_finite()) or n < 0 for n in nums) or row.vcpu == 0 or row.ram_gb == 0:
            raise ValueError("non-finite, negative or zero numeric value")
        return row

    def get_prices(self):
        rows, self.skipped = [], []
        with open(self.csv_path, newline="") as f:
            for i, r in enumerate(csv.DictReader(f), start=2):
                try:
                    rows.append(self._parse(r))
                except (KeyError, ValueError, TypeError, InvalidOperation, AttributeError) as e:
                    if self.strict:
                        raise ValueError(f"pricing CSV line {i}: {e}")
                    self.skipped.append((i, str(e)))
                    log.warning("pricing CSV line %s skipped: %s", i, e)
        if self.skipped:
            log.warning("pricing CSV: %d row(s) skipped, %d loaded", len(self.skipped), len(rows))
        return rows


def query_pricing(session, provider=None, region=None, pricing_model=None, min_vcpu=None, min_ram=None,
                  gpu_type=None, min_gpu=None):
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
    if gpu_type:
        q = q.where(PricingRecord.gpu_type == gpu_type)
    if min_gpu is not None:
        q = q.where(PricingRecord.gpu_count >= min_gpu)
    q = q.order_by(PricingRecord.provider, PricingRecord.region, PricingRecord.instance_type, PricingRecord.pricing_model)
    return list(session.scalars(q))


def all_rows(session):
    return [r.to_row() for r in session.scalars(select(PricingRecord))]


def freshness(snapshot_date, stale_after_days=30, today=None):
    """Age of a pricing snapshot (Requirement FR-PRC-05 / NFR-05)."""
    today = today or date.today()
    age = (today - date.fromisoformat(snapshot_date)).days
    return {"snapshot_date": snapshot_date, "age_days": max(age, 0),
            "status": "stale" if age > stale_after_days else "fresh", "stale_after_days": stale_after_days}


def pricing_meta(session, stale_after_days=30, today=None):
    """Snapshot freshness plus the regions / GPU types present in the data."""
    from backend.utils.constants import REGION_GROUPS
    rows = list(session.scalars(select(PricingRecord)))
    if not rows:
        return {"records": 0, "freshness": None, "regions": {}, "gpu_types": [], "region_groups": {}}
    newest = max(r.price_snapshot_date for r in rows)
    regions = {}
    for r in rows:
        regions.setdefault(r.provider, set()).add(r.region)
    return {
        "records": len(rows),
        "freshness": freshness(newest, stale_after_days, today),
        "oldest_snapshot_date": min(r.price_snapshot_date for r in rows),
        "sources": sorted({r.source for r in rows}),
        "regions": {p: sorted(v) for p, v in regions.items()},
        "gpu_types": sorted({r.gpu_type for r in rows if r.gpu_type}),
        "region_groups": {k: {"label": g["label"], "regions": g["regions"]} for k, g in REGION_GROUPS.items()},
    }
