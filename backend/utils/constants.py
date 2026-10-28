PROVIDERS = ("AWS", "Azure", "GCP")
PRICING_MODELS = ("on_demand", "spot", "reserved")
STORAGE_TYPES = ("SSD", "HDD")
USAGE_PATTERNS = ("steady-state", "bursty", "batch/scheduled", "gpu-intensive")
INTERRUPTION_RISKS = ("low", "medium", "high")
# Requirement Table 4.1: runtime must be > 0 and at most 730 h/month (average month).
MAX_RUNTIME_HOURS = 730
DEFAULT_RUNTIME_HOURS = 720
# Reserved/committed pricing is only offered to steady workloads running at least this many hours/month
# (just above the ~482 h break-even for a 34% discount; Requirement FR-CST-06).
RESERVED_MIN_HOURS = 500
MODEL_LABELS = {"on_demand": "On-Demand", "spot": "Spot/Preemptible", "reserved": "Reserved/Committed"}
BASELINE_KEYS = ("aws_on_demand", "azure_on_demand", "gcp_on_demand", "cheapest_on_demand")

# Provider-specific region names grouped by geography, so one choice ("us") compares all three providers.
# Users may also pass an exact region name or "any".
REGION_GROUPS = {
    "us": {"label": "United States", "regions": {"AWS": ["us-east-1"], "Azure": ["eastus"], "GCP": ["us-central1"]}},
    "europe": {"label": "Europe", "regions": {"AWS": ["eu-west-1"], "Azure": ["westeurope"], "GCP": ["europe-west1"]}},
}
