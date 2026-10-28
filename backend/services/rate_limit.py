"""Minimal in-memory fixed-window rate limiter (per client IP). Good enough for a single-process deployment;
put a reverse proxy / shared store in front for multi-process setups."""
import time
from collections import defaultdict

from flask import jsonify, request


def install_rate_limit(app):
    limit = app.config.get("RATE_LIMIT_REQUESTS", 0)
    window = app.config.get("RATE_LIMIT_WINDOW_SECONDS", 60)
    if not limit:
        return
    hits = defaultdict(list)

    @app.before_request
    def _limit():
        if request.path == "/api/health" or request.method == "OPTIONS":
            return None
        now, ip = time.monotonic(), request.headers.get("X-Forwarded-For", request.remote_addr or "?").split(",")[0].strip()
        recent = [t for t in hits[ip] if now - t < window]
        if len(recent) >= limit:
            hits[ip] = recent
            resp = jsonify({"error": "rate_limited", "message": "Too many requests. Please slow down."})
            resp.status_code = 429
            resp.headers["Retry-After"] = str(window)
            return resp
        recent.append(now)
        hits[ip] = recent
        return None
