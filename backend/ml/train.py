"""Train / evaluate the workload classifier.   python -m backend.ml.train [--csv labelled_profiles.csv]

CSV columns: the profile field names (vcpu, ram_gb, storage_gb, expected_runtime_hours_per_month,
monthly_data_transfer_out_gb, monthly_data_transfer_in_gb, gpu_required, gpu_count, interruption_tolerant)
plus a `label` column holding one of the four usage patterns."""
import csv
import json
import sys

from backend.ml.classifier import train
from backend.ml.features import CLASSES, to_vector


def _bool(v):
    return str(v).strip().lower() in ("1", "true", "yes", "y")


def load_csv(path):
    X, y = [], []
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            if r["label"] not in CLASSES:
                raise SystemExit(f"unknown label {r['label']!r}; expected one of {CLASSES}")
            p = {k: (float(r[k]) if r.get(k) not in (None, "") else None) for k in
                 ("vcpu", "ram_gb", "storage_gb", "expected_runtime_hours_per_month",
                  "monthly_data_transfer_out_gb", "monthly_data_transfer_in_gb", "gpu_count")}
            p["gpu_required"] = _bool(r.get("gpu_required", "0"))
            p["interruption_tolerant"] = _bool(r.get("interruption_tolerant", "0"))
            X.append(to_vector(p))
            y.append(r["label"])
    return X, y


if __name__ == "__main__":
    if "--csv" in sys.argv:
        X, y = load_csv(sys.argv[sys.argv.index("--csv") + 1])
        metrics, _ = train(X, y)
    else:
        metrics, _ = train()
    print(json.dumps(metrics, indent=2))
