from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.db import Base


def D(x):
    return Decimal(str(x))


@dataclass(frozen=True)
class Workload:
    """Plain, immutable workload used by the engines (no ORM dependency)."""
    vcpu: Decimal
    ram_gb: Decimal
    storage_gb: Decimal
    storage_type: str
    monthly_data_transfer_in_gb: Decimal
    monthly_data_transfer_out_gb: Decimal
    usage_pattern: str
    gpu_required: bool
    gpu_type: Optional[str]
    expected_runtime_hours_per_month: Decimal
    interruption_tolerant: bool
    preferred_region: str = "any"

    @classmethod
    def from_dict(cls, d):
        return cls(
            vcpu=D(d["vcpu"]), ram_gb=D(d["ram_gb"]), storage_gb=D(d["storage_gb"]),
            storage_type=d["storage_type"],
            monthly_data_transfer_in_gb=D(d["monthly_data_transfer_in_gb"]),
            monthly_data_transfer_out_gb=D(d["monthly_data_transfer_out_gb"]),
            usage_pattern=d["usage_pattern"], gpu_required=d["gpu_required"], gpu_type=d.get("gpu_type"),
            expected_runtime_hours_per_month=D(d["expected_runtime_hours_per_month"]),
            interruption_tolerant=d["interruption_tolerant"],
            preferred_region=d.get("preferred_region", "any"))


class WorkloadProfile(Base):
    __tablename__ = "workload_profiles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vcpu: Mapped[float] = mapped_column(Float)
    ram_gb: Mapped[float] = mapped_column(Float)
    storage_gb: Mapped[float] = mapped_column(Float)
    storage_type: Mapped[str] = mapped_column(String(8))
    monthly_data_transfer_in_gb: Mapped[float] = mapped_column(Float)
    monthly_data_transfer_out_gb: Mapped[float] = mapped_column(Float)
    usage_pattern: Mapped[str] = mapped_column(String(32))
    gpu_required: Mapped[bool] = mapped_column(Boolean)
    gpu_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    expected_runtime_hours_per_month: Mapped[float] = mapped_column(Float)
    interruption_tolerant: Mapped[bool] = mapped_column(Boolean)
    preferred_region: Mapped[str] = mapped_column(String(64), default="any")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    FIELDS = ("vcpu", "ram_gb", "storage_gb", "storage_type", "monthly_data_transfer_in_gb",
              "monthly_data_transfer_out_gb", "usage_pattern", "gpu_required", "gpu_type",
              "expected_runtime_hours_per_month", "interruption_tolerant", "preferred_region")

    def to_dict(self):
        d = {"id": self.id}
        for f in self.FIELDS:
            v = getattr(self, f)
            if isinstance(v, float) and v.is_integer():
                v = int(v)
            d[f] = v
        d["created_at"] = self.created_at.isoformat() if self.created_at else None
        return d
