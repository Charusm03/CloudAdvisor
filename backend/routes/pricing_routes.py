from flask import Blueprint, current_app, jsonify, request

from backend.database.db import session_scope
from backend.services.pricing_service import pricing_meta, query_pricing
from backend.utils.constants import PRICING_MODELS, PROVIDERS
from backend.utils.validation import ValidationError

bp = Blueprint("pricing", __name__, url_prefix="/api/pricing")


def _num(name):
    v = request.args.get(name)
    if v is None:
        return None
    try:
        return float(v)
    except ValueError:
        raise ValidationError(name, f"{name} must be a number")


@bp.get("")
def get_pricing():
    provider, model = request.args.get("provider"), request.args.get("pricing_model")
    if provider and provider not in PROVIDERS:
        raise ValidationError("provider", f"provider must be one of {', '.join(PROVIDERS)}")
    if model and model not in PRICING_MODELS:
        raise ValidationError("pricing_model", f"pricing_model must be one of {', '.join(PRICING_MODELS)}")
    with session_scope() as s:
        rows = query_pricing(s, provider, request.args.get("region"), model, _num("min_vcpu"), _num("min_ram"),
                             request.args.get("gpu_type") or None, _num("min_gpu"))
        out = [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]
    return jsonify(out)


@bp.get("/meta")
def get_meta():
    """Snapshot freshness (date, age in days, fresh/stale), sources, regions, GPU types and region groups."""
    with session_scope() as s:
        return jsonify(pricing_meta(s, current_app.config["PRICING_STALE_AFTER_DAYS"]))
