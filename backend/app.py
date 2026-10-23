from flask import Flask, jsonify
from flask_cors import CORS

from backend.config import Config
from backend.database.db import init_db, session_scope
from backend.database.seed import seed_pricing
from backend.routes import pricing_routes, recommendation_routes, workload_routes
from backend.routes.errors import register_error_handlers


def create_app(overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)
    CORS(app, origins=app.config["CORS_ORIGINS"])
    init_db(app, app.config["SQLALCHEMY_DATABASE_URI"])
    with app.app_context(), session_scope() as s:
        seed_pricing(s, app.config["PRICING_CSV"])  # no-op when already seeded
    for bp in (workload_routes.bp, pricing_routes.bp, recommendation_routes.bp):
        app.register_blueprint(bp)
    register_error_handlers(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app


if __name__ == "__main__":
    create_app().run(debug=True, port=5000)
