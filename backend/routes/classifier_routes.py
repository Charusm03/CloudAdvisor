from flask import Blueprint, jsonify, request

from backend.ml.classifier import MLWorkloadClassifier
from backend.utils.validation import ValidationError

bp = Blueprint("classifier", __name__, url_prefix="/api/classifier")


@bp.post("/predict")
def predict():
    """Advisory pattern prediction from a (possibly partial) profile. Never changes eligibility rules."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError("body", "Request body must be a JSON object")
    block = MLWorkloadClassifier.classify(data, selected=data.get("usage_pattern"))
    if block is None:
        return jsonify({"error": "classifier_unavailable", "message": "The ML classifier is not available."}), 503
    return jsonify(block)


@bp.get("/metrics")
def metrics():
    m = MLWorkloadClassifier.metrics()
    if m is None:
        return jsonify({"error": "not_found", "message": "No training metrics found. Run python -m backend.ml.train."}), 404
    return jsonify(m)
