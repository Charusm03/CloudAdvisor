"""All tunable settings live here: app config, cost-model constants, ranking weights."""
import os
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", f"sqlite:///{ROOT / 'advisor.db'}")
    PRICING_CSV = os.environ.get("PRICING_CSV", str(ROOT / "data" / "pricing.csv"))
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    MAX_CONTENT_LENGTH = 16 * 1024  # request size limit (bytes)
    TESTING = False


@dataclass(frozen=True)
class CostConfig:
    # Average billable hours in a month. Reserved capacity is billed for this many hours
    # (or the runtime, if larger) regardless of how long the workload actually runs.
    hours_per_month: Decimal = Decimal("730")
    # Extra compute billed on spot capacity to re-run interrupted work (same value as the report).
    spot_rerun_overhead: Decimal = Decimal("0.10")
    reserved_billed_full_month: bool = True


@dataclass(frozen=True)
class ScoringConfig:
    """score = w_cost*cost_score + w_fit*fit_score + w_suitability*suitability
               - interruption_penalty - commitment_penalty
    cost_score = cheapest_total / candidate_total  (1.0 for the cheapest)."""
    w_cost: Decimal = Decimal("0.70")
    w_fit: Decimal = Decimal("0.10")
    w_suitability: Decimal = Decimal("0.20")
    interruption_penalty: dict = field(default_factory=lambda: {
        "low": Decimal("0"), "medium": Decimal("0.03"), "high": Decimal("0.08")})
    # Extra penalty on reserved/committed pricing for bursty workloads.
    bursty_commitment_penalty: Decimal = Decimal("0.15")
    # pattern -> pricing model -> suitability in [0, 1]
    suitability: dict = field(default_factory=lambda: {
        "steady-state": {"reserved": Decimal("1.0"), "on_demand": Decimal("0.7"), "spot": Decimal("0.3")},
        "bursty": {"on_demand": Decimal("1.0"), "spot": Decimal("0.5"), "reserved": Decimal("0.1")},
        "batch/scheduled": {"spot": Decimal("1.0"), "on_demand": Decimal("0.7"), "reserved": Decimal("0.3")},
        "gpu-intensive": {"on_demand": Decimal("1.0"), "spot": Decimal("0.6"), "reserved": Decimal("0.6")},
    })
    # Candidates whose totals differ by less than this percentage are called "effectively tied".
    tie_threshold_pct: Decimal = Decimal("2")
    # Egress counts as a material cost driver at or above this share of the total.
    egress_material_share: Decimal = Decimal("0.25")


DEFAULT_COST_CONFIG = CostConfig()
DEFAULT_SCORING_CONFIG = ScoringConfig()
