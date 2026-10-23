from dataclasses import dataclass
from decimal import Decimal
from typing import Optional, Tuple

from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.db import Base


@dataclass(frozen=True)
class PricingRow:
    """One normalised price record (plain dataclass used by the engines)."""
    provider: str
    region: str
    instance_type: str
    vcpu: Decimal
    ram_gb: Decimal
    gpu_type: Optional[str]
    gpu_count: int
    storage_types: Tuple[str, ...]
    pricing_model: str
    price_per_hour: Decimal
    storage_price_per_gb_month: Decimal
    egress_price_per_gb: Decimal
    ingress_price_per_gb: Decimal
    interruption_risk: str
    commitment_months: int
    source: str
    price_snapshot_date: str


class PricingRecord(Base):
    __tablename__ = "pricing_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(16), index=True)
    region: Mapped[str] = mapped_column(String(32), index=True)
    instance_type: Mapped[str] = mapped_column(String(64))
    vcpu: Mapped[float] = mapped_column(Float)
    ram_gb: Mapped[float] = mapped_column(Float)
    gpu_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    gpu_count: Mapped[int] = mapped_column(Integer, default=0)
    storage_type_supported: Mapped[str] = mapped_column(String(16))  # e.g. "SSD|HDD"
    pricing_model: Mapped[str] = mapped_column(String(16), index=True)
    price_per_hour: Mapped[float] = mapped_column(Float)
    storage_price_per_gb_month: Mapped[float] = mapped_column(Float)
    egress_price_per_gb: Mapped[float] = mapped_column(Float)
    ingress_price_per_gb: Mapped[float] = mapped_column(Float)
    interruption_risk: Mapped[str] = mapped_column(String(8))
    commitment_months: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(256))
    price_snapshot_date: Mapped[str] = mapped_column(String(10))

    def to_row(self):
        D = lambda x: Decimal(str(x))  # float repr round-trips the literal in the CSV
        return PricingRow(
            provider=self.provider, region=self.region, instance_type=self.instance_type,
            vcpu=D(self.vcpu), ram_gb=D(self.ram_gb), gpu_type=self.gpu_type, gpu_count=self.gpu_count,
            storage_types=tuple(self.storage_type_supported.split("|")), pricing_model=self.pricing_model,
            price_per_hour=D(self.price_per_hour), storage_price_per_gb_month=D(self.storage_price_per_gb_month),
            egress_price_per_gb=D(self.egress_price_per_gb), ingress_price_per_gb=D(self.ingress_price_per_gb),
            interruption_risk=self.interruption_risk, commitment_months=self.commitment_months,
            source=self.source, price_snapshot_date=self.price_snapshot_date)
