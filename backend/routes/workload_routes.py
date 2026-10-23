from flask import Blueprint, jsonify, request

from backend.database.db import session_scope
from backend.services import workload_service as ws

bp = Blueprint("workloads", __name__, url_prefix="/api/workloads")


@bp.post("")
def create():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "validation_error", "message": "Request body must be valid JSON", "field": "body"}), 400
    with session_scope() as s:
        return jsonify(ws.create_workload(s, data)), 201


@bp.get("")
def list_all():
    with session_scope() as s:
        return jsonify(ws.list_workloads(s))


@bp.get("/<int:wid>")
def get_one(wid):
    with session_scope() as s:
        w = ws.get_workload(s, wid)
    if w is None:
        return jsonify({"error": "not_found", "message": f"Workload {wid} not found"}), 404
    return jsonify(w)
