#!/bin/sh
# Runs backend (pytest) and frontend (vitest) suites.
set -e
python -m pytest -q
(cd frontend && npm test)
