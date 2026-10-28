import json

import pytest

pytest.importorskip("sklearn")
from backend.ml.classifier import METRICS_PATH, MLWorkloadClassifier, train
from backend.ml.features import CLASSES, FEATURES, generate, to_vector
from backend.services.candidate_service import find_candidates
from backend.tests.helpers import BASE_WORKLOAD, rec, wl


def test_generated_data_is_balanced_and_reproducible():
    X1, y1 = generate(n_per_class=50, seed=1)
    X2, y2 = generate(n_per_class=50, seed=1)
    assert X1 == X2 and y1 == y2 and set(y1) == set(CLASSES) and len(X1[0]) == len(FEATURES)


def test_training_reports_cv_metrics_and_feature_importance():
    X, y = generate(n_per_class=120)
    m, model = train(X, y, save=False)
    assert 0.8 < m["accuracy_mean"] <= 1 and 0.8 < m["f1_macro_mean"] <= 1 and "stratified" in m["cv"]
    assert set(m["feature_importance"]) == set(FEATURES) and abs(sum(m["feature_importance"].values()) - 1) < 0.01


def test_shipped_metrics_file_present():
    assert json.loads(METRICS_PATH.read_text())["accuracy_mean"] > 0.8


def test_predicts_archetypes():
    c = MLWorkloadClassifier.classify
    assert c({**BASE_WORKLOAD, "expected_runtime_hours_per_month": 730})["predicted_pattern"] == "steady-state"
    assert c({**BASE_WORKLOAD, "vcpu": 16, "ram_gb": 64, "storage_gb": 1500, "expected_runtime_hours_per_month": 60,
              "interruption_tolerant": True})["predicted_pattern"] == "batch/scheduled"
    assert c({**BASE_WORKLOAD, "gpu_required": True, "gpu_type": "NVIDIA T4", "gpu_count": 2,
              "expected_runtime_hours_per_month": 200})["predicted_pattern"] == "gpu-intensive"


def test_classification_block_shape():
    b = MLWorkloadClassifier.classify(BASE_WORKLOAD, selected="steady-state")
    assert b["advisory_only"] and b["strategy_prior"] and b["suggested_defaults"] and len(b["top_features"]) == 3
    assert abs(sum(b["probabilities"].values()) - 1) < 0.01 and b["matches_selected"] in (True, False)


def test_prediction_never_changes_eligibility():
    """FR-CLS-06: even if the model predicts 'steady-state', a bursty selection still gets no reserved candidate."""
    w = wl(usage_pattern="bursty", expected_runtime_hours_per_month=730)
    recs = [rec(), rec(model="reserved", price="0.07", commit=12)]
    assert MLWorkloadClassifier.classify({**BASE_WORKLOAD, "expected_runtime_hours_per_month": 730})["predicted_pattern"] == "steady-state"
    assert {c.pricing_model for c in find_candidates(w, recs)} == {"on_demand"}


def test_preview_includes_classification_and_keeps_selected_pattern(client, payload):
    body = client.post("/api/recommendations/preview", json={**payload, "usage_pattern": "bursty",
                                                             "expected_runtime_hours_per_month": 730}).get_json()
    assert body["workload"]["usage_pattern"] == "bursty" and body["classification"]["selected_pattern"] == "bursty"
    assert all(c["pricing_model"] != "reserved" for c in body["candidates"])


def test_classifier_endpoints(client, payload):
    r = client.post("/api/classifier/predict", json={"vcpu": 8, "expected_runtime_hours_per_month": 700})  # partial profile
    assert r.status_code == 200 and r.get_json()["predicted_pattern"] in CLASSES
    assert client.post("/api/classifier/predict", data="x").status_code == 400
    assert client.get("/api/classifier/metrics").get_json()["n_samples"] > 0
