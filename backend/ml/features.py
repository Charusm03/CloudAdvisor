"""Feature extraction + synthetic archetype data for the workload-pattern classifier (Requirement Module 5).

No public labelled dataset of *workload profiles* exists, so (as the project report states) the training set is
generated from documented archetype ranges with random variation and deliberate overlap between classes. It can be
supplemented with real, labelled profiles via `--csv` in `python -m backend.ml.train`.
"""
import random

FEATURES = ["vcpu", "ram_gb", "storage_gb", "runtime_hours", "egress_gb", "ingress_gb",
            "gpu_required", "gpu_count", "interruption_tolerant", "runtime_ratio", "ram_per_vcpu"]
CLASSES = ["steady-state", "bursty", "batch/scheduled", "gpu-intensive"]
HOURS_PER_MONTH = 730


def to_vector(p):
    """Profile dict (validated or partial) -> feature list in FEATURES order."""
    vcpu = float(p.get("vcpu") or 2)
    ram = float(p.get("ram_gb") or 8)
    rt = p.get("expected_runtime_hours_per_month")
    rt = 720.0 if rt is None else float(rt)
    gpu_req = bool(p.get("gpu_required"))
    gpu_n = float(p.get("gpu_count") or (1 if gpu_req else 0))
    return [vcpu, ram, float(p.get("storage_gb") or 0), rt,
            float(p.get("monthly_data_transfer_out_gb") or 0), float(p.get("monthly_data_transfer_in_gb") or 0),
            1.0 if gpu_req else 0.0, gpu_n, 1.0 if p.get("interruption_tolerant") else 0.0,
            rt / HOURS_PER_MONTH, ram / max(vcpu, 1.0)]


# (runtime range h, P(interruption tolerant), P(gpu), vcpu choices, ram/vcpu choices, storage range, egress range)
ARCHETYPES = {
    "steady-state": dict(rt=(560, 730), tol=0.15, gpu=0.01, vcpu=(2, 4, 8, 16), rpv=(2, 4, 8), st=(50, 800), eg=(20, 1500)),
    "bursty": dict(rt=(80, 600), tol=0.35, gpu=0.01, vcpu=(2, 4, 8), rpv=(2, 4), st=(20, 300), eg=(5, 600)),
    "batch/scheduled": dict(rt=(10, 300), tol=0.85, gpu=0.01, vcpu=(4, 8, 16, 32), rpv=(2, 4, 8), st=(100, 2000), eg=(0, 300)),
    "gpu-intensive": dict(rt=(20, 730), tol=0.55, gpu=1.0, vcpu=(2, 4, 8, 16, 32), rpv=(2, 4, 8), st=(20, 1500), eg=(0, 1000)),
}


def generate(n_per_class=500, seed=42, label_noise=0.04):
    rnd = random.Random(seed)
    X, y = [], []
    for cls, a in ARCHETYPES.items():
        for _ in range(n_per_class):
            vcpu = rnd.choice(a["vcpu"])
            gpu = rnd.random() < a["gpu"]
            p = {"vcpu": vcpu, "ram_gb": vcpu * rnd.choice(a["rpv"]),
                 "storage_gb": rnd.uniform(*a["st"]), "expected_runtime_hours_per_month": rnd.uniform(*a["rt"]),
                 "monthly_data_transfer_out_gb": rnd.uniform(*a["eg"]),
                 "monthly_data_transfer_in_gb": rnd.uniform(0, a["eg"][1]),
                 "gpu_required": gpu, "gpu_count": rnd.choice((1, 1, 1, 2, 4)) if gpu else 0,
                 "interruption_tolerant": rnd.random() < a["tol"]}
            label = cls if rnd.random() > label_noise else rnd.choice(CLASSES)
            X.append(to_vector(p))
            y.append(label)
    return X, y
