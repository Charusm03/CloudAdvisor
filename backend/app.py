import os

from flask import Flask, jsonify
from flask_cors import CORS

from backend.config import Config
from backend.database.db import init_db, session_scope
from backend.database.seed import seed_pricing
from backend.routes import classifier_routes, pricing_routes, recommendation_routes, workload_routes
from backend.routes.errors import register_error_handlers
from backend.services.rate_limit import install_rate_limit


def create_app(overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)
    CORS(app, origins=app.config["CORS_ORIGINS"])
    init_db(app, app.config["SQLALCHEMY_DATABASE_URI"])
    with app.app_context(), session_scope() as s:
        seed_pricing(s, app.config["PRICING_CSV"], strict=app.config["PRICING_STRICT"])  # no-op when already seeded
    install_rate_limit(app)
    for bp in (workload_routes.bp, pricing_routes.bp, recommendation_routes.bp, classifier_routes.bp):
        app.register_blueprint(bp)
    register_error_handlers(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app


if __name__ == "__main__":
    # Debug is OFF unless FLASK_DEBUG=1 (never enable it on a shared host). Use gunicorn in production.
    _app = create_app()
    _app.run(debug=_app.config["DEBUG"], host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", "5000")))
