"""Random-forest workload-pattern classifier (Requirement FR-CLS-01..07).

* Predicts one of the four fixed usage patterns from the workload profile.
* It is ADVISORY: the engines keep using the pattern the user selected, and the prediction can never relax the
  pricing-model eligibility rules (FR-CLS-06). It supplies a strategy prior for the explanation and suggested defaults
  for blank fields.
* Exposes feature importances (FR-CLS-07). Training metrics (stratified CV accuracy and macro-F1, FR-CLS-05) are
  stored next to the model by `python -m backend.ml.train`.
"""
import json
import logging
from pathlib import Path

from backend.ml.features import CLASSES, FEATURES, generate, to_vector

log = logging.getLogger(__name__)
ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "workload_classifier.joblib"
METRICS_PATH = ARTIFACT_DIR / "metrics.json"

STRATEGY_PRIOR = {
    "steady-state": "Steady services usually benefit from reserved/committed capacity when they run most of the month.",
    "bursty": "Bursty workloads usually favour flexible on-demand capacity; long commitments tend to be wasted.",
    "batch/scheduled": "Batch and scheduled jobs usually favour spot/preemptible capacity if they can restart.",
    "gpu-intensive": "GPU workloads usually need guaranteed on-demand GPUs; spot GPUs are cheap but often interrupted.",
}
DEFAULTS = {  # suggested values for blank fields, by predicted/selected class
    "steady-state": {"expected_runtime_hours_per_month": 720, "interruption_tolerant": False},
    "bursty": {"expected_runtime_hours_per_month": 320, "interruption_tolerant": False},
    "batch/scheduled": {"expected_runtime_hours_per_month": 160, "interruption_tolerant": True},
    "gpu-intensive": {"expected_runtime_hours_per_month": 200, "interruption_tolerant": True},
}


def train(X=None, y=None, seed=42, save=True):
    """Train, cross-validate and (optionally) persist the model. Returns the metrics dict."""
    import joblib
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import StratifiedKFold, cross_validate

    if X is None:
        X, y = generate(seed=seed)
        source = "synthetic archetypes (backend/ml/features.py), seed %d" % seed
    else:
        source = "supplied labelled profiles"
    model = RandomForestClassifier(n_estimators=200, min_samples_leaf=2, random_state=seed, n_jobs=1)
    cv = cross_validate(model, X, y, cv=StratifiedKFold(5, shuffle=True, random_state=seed),
                        scoring={"accuracy": "accuracy", "f1_macro": "f1_macro"})
    model.fit(X, y)
    metrics = {
        "model": "RandomForestClassifier(n_estimators=200, min_samples_leaf=2)",
        "training_data": source, "n_samples": len(X), "classes": list(model.classes_),
        "cv": "stratified 5-fold",
        "accuracy_mean": round(float(cv["test_accuracy"].mean()), 4), "accuracy_std": round(float(cv["test_accuracy"].std()), 4),
        "f1_macro_mean": round(float(cv["test_f1_macro"].mean()), 4), "f1_macro_std": round(float(cv["test_f1_macro"].std()), 4),
        "feature_importance": {f: round(float(v), 4) for f, v in
                               sorted(zip(FEATURES, model.feature_importances_), key=lambda t: -t[1])},
        "note": "Synthetic labels: scores show the model learns the archetypes, not real-world accuracy.",
    }
    if save:
        ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, MODEL_PATH)
        METRICS_PATH.write_text(json.dumps(metrics, indent=2) + "\n")
    return metrics, model


class MLWorkloadClassifier:
    _model = None

    @classmethod
    def available(cls):
        try:
            return cls._load() is not None
        except Exception:  # sklearn missing or artifact unreadable
            return False

    @classmethod
    def _load(cls):
        if cls._model is None:
            import joblib
            if MODEL_PATH.exists():
                cls._model = joblib.load(MODEL_PATH)
            else:
                log.info("classifier artifact missing - training in memory")
                cls._model = train(save=False)[1]
        return cls._model

    @classmethod
    def metrics(cls):
        return json.loads(METRICS_PATH.read_text()) if METRICS_PATH.exists() else None

    @classmethod
    def classify(cls, profile, selected=None):
        """Return the classification block, or None when the model cannot be used."""
        try:
            model = cls._load()
        except Exception as e:  # noqa: BLE001 - classifier is optional; never break recommendations
            log.warning("classifier unavailable: %s", e)
            return None
        vec = to_vector(profile)
        proba = model.predict_proba([vec])[0]
        order = sorted(range(len(proba)), key=lambda i: -proba[i])
        pred = str(model.classes_[order[0]])
        return {
            "predicted_pattern": pred,
            "confidence": round(float(proba[order[0]]), 3),
            "probabilities": {str(model.classes_[i]): round(float(proba[i]), 3) for i in order},
            "selected_pattern": selected,
            "matches_selected": (selected == pred) if selected else None,
            "strategy_prior": STRATEGY_PRIOR[pred],
            "suggested_defaults": DEFAULTS[pred],
            "top_features": [{"feature": f, "importance": round(float(model.feature_importances_[FEATURES.index(f)]), 3)}
                             for f in sorted(FEATURES, key=lambda f: -model.feature_importances_[FEATURES.index(f)])[:3]],
            "advisory_only": True,
        }
