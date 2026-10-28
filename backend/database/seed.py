"""Initialise / refresh the pricing table from data/pricing.csv.

    python -m backend.database.seed             seed only when the table is empty
    python -m backend.database.seed --reset     wipe and reload (also available as --refresh)

Run --refresh after updating the CSV (e.g. from a cron job or the CI workflow) to publish a new snapshot."""
import sys

from sqlalchemy import delete, func, select

from backend.models.pricing import PricingRecord
from backend.services.pricing_service import StaticPricingProvider


def seed_pricing(session, csv_path, reset=False, strict=False):
    if reset:
        session.execute(delete(PricingRecord))
    if session.scalar(select(func.count()).select_from(PricingRecord)) > 0:
        return 0
    rows = StaticPricingProvider(csv_path, strict=strict).get_prices()
    for r in rows:
        session.add(PricingRecord(
            provider=r.provider, region=r.region, instance_type=r.instance_type,
            vcpu=float(r.vcpu), ram_gb=float(r.ram_gb), gpu_type=r.gpu_type, gpu_count=r.gpu_count,
            storage_type_supported="|".join(r.storage_types), pricing_model=r.pricing_model,
            price_per_hour=float(r.price_per_hour),
            storage_price_per_gb_month=float(r.storage_price_per_gb_month),
            egress_price_per_gb=float(r.egress_price_per_gb), ingress_price_per_gb=float(r.ingress_price_per_gb),
            interruption_risk=r.interruption_risk, commitment_months=r.commitment_months,
            source=r.source, price_snapshot_date=r.price_snapshot_date))
    session.commit()
    return len(rows)


if __name__ == "__main__":
    from backend.app import create_app
    from backend.database.db import session_scope
    app = create_app()
    with app.app_context(), session_scope() as s:
        print("seeded", seed_pricing(s, app.config["PRICING_CSV"], reset=("--reset" in sys.argv or "--refresh" in sys.argv)), "records")
