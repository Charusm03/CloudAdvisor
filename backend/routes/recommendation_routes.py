from flask import Blueprint, jsonify, request

from backend.database.db import session_scope
from backend.services import workload_service as ws
from backend.services.pricing_service import all_rows
from backend.services.recommendation_engine import recommend
from backend.services.workload_classifier import ManualWorkloadClassifier
from backend.utils.validation import ValidationError, validate_workload

bp = Blueprint("recommendations", __name__, url_prefix="/api/recommendations")


def _run(session, workload_dict):
    # The pattern comes from a classifier interface; today it simply echoes the user's selection.
    workload_dict = dict(workload_dict)
    workload_dict["usage_pattern"] = ManualWorkloadClassifier(workload_dict["usage_pattern"]).predict()
    w = ws.to_engine_workload(workload_dict)
    result = recommend(w, all_rows(session))
    result["workload"] = workload_dict
    return result


@bp.post("")
def from_saved():
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not isinstance(data.get("workload_id"), int) or isinstance(data.get("workload_id"), bool):
        raise ValidationError("workload_id", "workload_id must be an integer")
    with session_scope() as s:
        wl = ws.get_workload(s, data["workload_id"])
        if wl is None:
            return jsonify({"error": "not_found", "message": f"Workload {data['workload_id']} not found"}), 404
        return jsonify(_run(s, wl))


@bp.post("/preview")
def preview():
    data = request.get_json(silent=True)
    if data is None:
        raise ValidationError("body", "Request body must be valid JSON")
    clean = validate_workload(data)
    with session_scope() as s:
        return jsonify(_run(s, clean))
