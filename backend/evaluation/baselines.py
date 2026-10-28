"""Evaluation of the advisor against baseline placement strategies (Requirement OBJ-07 / AC-08).

Strategies (all priced with the same cost engine and the same compatible candidates):
  advisor            rank-1 of the recommendation engine (eligibility rules + cost ranking)
  always_aws         cheapest compatible AWS on-demand placement ("always use AWS, never think about pricing models")
  cheapest_on_demand cheapest compatible on-demand placement across providers
  round_robin        cycles AWS -> Azure -> GCP across the workload list, on-demand, cheapest instance of that provider
  random             a seeded random pick among the compatible, ELIGIBLE candidates (on-demand/spot/reserved)

    python -m backend.evaluation.baselines [--pricing path.csv] [--workloads N] [--seed S] [--markdown out.md]
"""
import argparse
import json
import random
import sys
from decimal import Decimal

from backend.services.candidate_service import find_candidates, is_compatible
from backend.services.cost_engine import compute_cost, money
from backend.services.pricing_service import StaticPricingProvider
from backend.models.workload import Workload

PROVIDERS = ("AWS", "Azure", "GCP")

REFERENCE_WORKLOADS = {  # report Table 6.1
    "W1 web backend": dict(vcpu=4, ram_gb=16, storage_gb=100, usage_pattern="steady-state", gpu_required=False, h=730, out=200, tol=False),
    "W2 batch": dict(vcpu=8, ram_gb=32, storage_gb=200, usage_pattern="batch/scheduled", gpu_required=False, h=150, out=50, tol=True),
    "W3 ML training": dict(vcpu=4, ram_gb=16, storage_gb=100, usage_pattern="gpu-intensive", gpu_required=True, h=200, out=20, tol=True),
    "W4 analytics DB": dict(vcpu=8, ram_gb=32, storage_gb=500, usage_pattern="steady-state", gpu_required=False, h=730, out=100, tol=False),
    "W5 dev/test": dict(vcpu=2, ram_gb=8, storage_gb=50, usage_pattern="bursty", gpu_required=False, h=100, out=10, tol=True),
}


def make_workload(d, region="any"):
    gpu = d["gpu_required"]
    return Workload(vcpu=Decimal(d["vcpu"]), ram_gb=Decimal(d["ram_gb"]), storage_gb=Decimal(d["storage_gb"]),
                    storage_type="SSD", monthly_data_transfer_in_gb=Decimal(0),
                    monthly_data_transfer_out_gb=Decimal(d["out"]), usage_pattern=d["usage_pattern"],
                    gpu_required=gpu, gpu_type="NVIDIA T4" if gpu else None, gpu_count=1 if gpu else 0,
                    expected_runtime_hours_per_month=Decimal(d["h"]), interruption_tolerant=d["tol"],
                    preferred_region=region)


def random_workloads(n, seed):
    rnd = random.Random(seed)
    out = {}
    for i in range(n):
        gpu = rnd.random() < 0.15
        pattern = "gpu-intensive" if gpu else rnd.choice(["steady-state", "bursty", "batch/scheduled"])
        h = rnd.choice([730, 720, 600]) if pattern == "steady-state" else rnd.choice([40, 100, 160, 320, 500])
        out[f"R{i + 1:02d}"] = dict(vcpu=rnd.choice([2, 4, 8]), ram_gb=rnd.choice([8, 16, 32]),
                                    storage_gb=rnd.choice([50, 100, 200, 500]), usage_pattern=pattern, gpu_required=gpu,
                                    h=h, out=rnd.choice([10, 50, 200, 1000]),
                                    tol=pattern == "batch/scheduled" or rnd.random() < 0.4)
    return out


def _cost(w, rec):
    return compute_cost(w, rec).total


def evaluate(records, workloads, seed=7):
    rnd = random.Random(seed)
    rows = []
    for i, (name, d) in enumerate(workloads.items()):
        w = make_workload(d)
        cands = find_candidates(w, records)
        if not cands:
            continue
        # on-demand pool ignores region duplicates by taking the cheapest per provider
        od = [r for r in cands if r.pricing_model == "on_demand"]
        priced = {id(r): _cost(w, r) for r in cands}
        best = min(cands, key=lambda r: (priced[id(r)], r.provider, r.region, r.instance_type, r.pricing_model))
        aws = [r for r in od if r.provider == "AWS"]
        rr_provider = PROVIDERS[i % 3]
        rr = [r for r in od if r.provider == rr_provider] or od
        strategies = {
            "advisor": best,
            "always_aws": min(aws, key=lambda r: priced[id(r)]) if aws else None,
            "cheapest_on_demand": min(od, key=lambda r: priced[id(r)]),
            "round_robin": min(rr, key=lambda r: priced[id(r)]),
            "random": rnd.choice(sorted(cands, key=lambda r: (r.provider, r.region, r.instance_type, r.pricing_model))),
        }
        rows.append({"workload": name,
                     "costs": {k: (None if v is None else float(money(priced[id(v)]))) for k, v in strategies.items()},
                     "advisor_choice": f"{best.provider} {best.instance_type} {best.pricing_model} ({best.region})"})
    return rows


def summarise(rows):
    out = {}
    for strat in ("always_aws", "cheapest_on_demand", "round_robin", "random"):
        pcts = [(r["costs"][strat] - r["costs"]["advisor"]) / r["costs"][strat] * 100
                for r in rows if r["costs"][strat]]
        out[strat] = {"mean_saving_pct": round(sum(pcts) / len(pcts), 1) if pcts else None,
                      "min_saving_pct": round(min(pcts), 1) if pcts else None,
                      "max_saving_pct": round(max(pcts), 1) if pcts else None, "n": len(pcts)}
    out["advisor_never_worse"] = all(
        r["costs"]["advisor"] <= min(v for v in r["costs"].values() if v is not None) + 1e-9 for r in rows)
    return out


def to_markdown(title, rows, summary):
    cols = ["advisor", "always_aws", "cheapest_on_demand", "round_robin", "random"]
    lines = [f"### {title}", "", "| Workload | Advisor choice | " + " | ".join(cols) + " |",
             "|---|---|" + "---|" * len(cols)]
    for r in rows:
        lines.append(f"| {r['workload']} | {r['advisor_choice']} | " +
                     " | ".join("n/a" if r["costs"][c] is None else f"${r['costs'][c]:,.2f}" for c in cols) + " |")
    lines += ["", "Mean saving of the advisor vs each baseline:", "",
              "| Baseline | Mean | Min | Max | Workloads |", "|---|---|---|---|---|"]
    for k in ("always_aws", "cheapest_on_demand", "round_robin", "random"):
        s = summary[k]
        lines.append(f"| {k} | {s['mean_saving_pct']}% | {s['min_saving_pct']}% | {s['max_saving_pct']}% | {s['n']} |")
    lines.append("")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pricing", default="data/pricing.csv")
    ap.add_argument("--reference", action="store_true", help="use the report's W1-W5 on the reference pricing snapshot")
    ap.add_argument("--workloads", type=int, default=20, help="number of random workloads")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--markdown")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    sections = []
    ref = StaticPricingProvider("backend/tests/fixtures/reference_pricing.csv").get_prices()
    rows = evaluate(ref, REFERENCE_WORKLOADS, a.seed)
    sections.append(("Report workloads W1-W5 on the report's reference snapshot (Table 6.2)", rows, summarise(rows)))
    if not a.reference:
        recs = StaticPricingProvider(a.pricing).get_prices()
        rows = evaluate(recs, random_workloads(a.workloads, a.seed), a.seed)
        sections.append((f"{len(rows)} random workloads on {a.pricing}", rows, summarise(rows)))
    if a.json:
        print(json.dumps([{"title": t, "rows": r, "summary": s} for t, r, s in sections], indent=2))
    md = "\n".join(to_markdown(*s) for s in sections)
    if a.markdown:
        open(a.markdown, "w").write(md)
    if not a.json:
        print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())
