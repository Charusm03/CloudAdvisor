from flask import jsonify
from werkzeug.exceptions import HTTPException

from backend.services.recommendation_engine import NoCompatibleCandidates
from backend.utils.validation import ValidationError


def register_error_handlers(app):
    @app.errorhandler(ValidationError)
    def _validation(e):
        return jsonify(e.to_dict()), 400

    @app.errorhandler(NoCompatibleCandidates)
    def _nocand(e):
        return jsonify({"error": "no_compatible_candidates", "message": str(e)}), 422

    @app.errorhandler(HTTPException)
    def _http(e):
        names = {400: "bad_request", 404: "not_found", 405: "method_not_allowed", 413: "payload_too_large"}
        return jsonify({"error": names.get(e.code, "http_error"), "message": e.description}), e.code

    @app.errorhandler(Exception)
    def _unexpected(e):
        app.logger.exception("unhandled error")
        return jsonify({"error": "internal_error", "message": "Unexpected server error"}), 500
