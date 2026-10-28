"""Explanations are generated directly from the arithmetic and the business rules (no ML, no SHAP/LIME).
Every sentence cites numbers taken from the cost breakdown, fit scores or the configured rules."""
from decimal import Decimal

from backend.config import DEFAULT_SCORING_CONFIG
from backend.services.candidate_service import eligibility_reason
from backend.services.cost_engine import money
from backend.utils.constants import MODEL_LABELS

PATTERN_TEXT = {
    ("steady-state", "reserved"): "committed pricing suits a steady-state workload that runs all month",
    ("steady-state", "on_demand"): "on-demand is safe for a steady-state workload but forgoes the commitment discount",
    ("steady-state", "spot"): "spot is a weak fit for a steady-state workload",
    ("bursty", "on_demand"): "on-demand avoids long commitments, which suits a bursty workload",
    ("bursty", "reserved"): "a long commitment is a poor fit for a bursty workload",
    ("bursty", "spot"): "spot can serve bursty work only if it tolerates interruption",
    ("batch/scheduled", "spot"): "spot capacity suits interruption-tolerant batch/scheduled work",
    ("batch/scheduled", "on_demand"): "on-demand is the safe choice for batch/scheduled work",
    ("batch/scheduled", "reserved"): "a commitment is rarely justified for batch/scheduled work",
    ("gpu-intensive", "on_demand"): "on-demand guarantees the requested GPU capacity",
    ("gpu-intensive", "spot"): "GPU spot capacity is cheap but frequently interrupted",
    ("gpu-intensive", "reserved"): "committed GPU capacity is only worthwhile for sustained use",
}


def _m(d):
    return f"${money(d):,.2f}"


def _pct(d):
    return f"{d.quantize(Decimal('0.1'))}%"


def label(rc):
    r = rc.rec
    return f"{r.provider} {r.instance_type} ({MODEL_LABELS[r.pricing_model]}, {r.region})"


def warnings_for(w, rc):
    r, out = rc.rec, []
    if r.pricing_model == "spot":
        out.append(f"Spot/preemptible capacity can be interrupted (risk: {r.interruption_risk}).")
        if r.interruption_risk == "high":
            out.append("High interruption risk - make sure the workload can checkpoint and restart.")
        out.append("Exact spot price changes and capacity availability are not modelled.")
    if r.pricing_model == "reserved":
        out.append(f"Requires a {r.commitment_months}-month commitment and is billed for the whole month.")
        if w.usage_pattern == "bursty":
            out.append("A long commitment is a poor fit for a bursty workload.")
    return out


def explain(w, rc, rank, ranked, cfg=DEFAULT_SCORING_CONFIG):
    r, c = rc.rec, rc.cost
    total = c.total
    reasons = [
        f"Satisfies the requested {w.vcpu.normalize():f} vCPU / {w.ram_gb.normalize():f} GB RAM "
        f"(offers {r.vcpu.normalize():f} vCPU / {r.ram_gb.normalize():f} GB)"
        + (f" and the requested {r.gpu_type} GPU." if w.gpu_required else "."),
        f"Estimated {_m(total)}/month = compute {_m(c.compute)} + storage {_m(c.storage)} "
        f"+ egress {_m(c.egress)} + ingress {_m(c.ingress)}.",
        f"Resource fit {rc.fit.score.quantize(Decimal('0.01'))} "
        f"(CPU {_pct(rc.fit.cpu_utilization * 100)} and RAM {_pct(rc.fit.ram_utilization * 100)} utilised).",
        f"Pricing model: {PATTERN_TEXT[(w.usage_pattern, r.pricing_model)]}.",
    ]
    if r.pricing_model == "spot":
        reasons.append(f"Interruption risk is {r.interruption_risk}; the cost includes "
                       f"{_pct(rc.cost.billed_hours / w.expected_runtime_hours_per_month * 100 - 100)} "
                       f"extra hours to re-run interrupted work.")
    else:
        reasons.append(f"Interruption risk: {r.interruption_risk}.")
    if total > 0 and c.egress / total >= cfg.egress_material_share:
        reasons.append(f"Outbound transfer of {w.monthly_data_transfer_out_gb.normalize():f} GB costs {_m(c.egress)} "
                       f"({_pct(c.egress / total * 100)} of the total), so egress materially affects the ranking.")

    tradeoffs = []
    top = ranked[0]
    if rank == 1:
        if len(ranked) > 1:
            nxt = ranked[1]
            diff = nxt.total - total
            if total > 0 and abs(diff) / total * 100 < cfg.tie_threshold_pct:
                summary_cmp = (f"It is effectively tied with {label(nxt)} (difference {_m(abs(diff))}, "
                               f"under {cfg.tie_threshold_pct}%), so factors outside the cost model can decide.")
            elif diff >= 0:
                summary_cmp = f"Its estimated cost is {_m(diff)}/month lower than the next-best candidate, {label(nxt)}."
            else:
                summary_cmp = (f"The next candidate, {label(nxt)}, is {_m(-diff)}/month cheaper but ranks lower "
                               f"on interruption constraints, pricing-model suitability or resource fit.")
        else:
            summary_cmp = "It is the only technically compatible candidate."
    else:
        diff = total - top.total
        pct = diff / top.total * 100 if top.total > 0 else Decimal(0)
        summary_cmp = f"It costs {_m(diff)}/month ({_pct(pct)}) more than the top-ranked option."

    # Trade-off: someone has cheaper compute but a higher total (typically because of egress or storage).
    cheaper_compute = [x for x in ranked if x is not rc and x.cost.compute < c.compute and x.total > total]
    if cheaper_compute:
        x = min(cheaper_compute, key=lambda k: k.cost.compute)
        if x.cost.egress - c.egress >= x.cost.storage - c.storage:
            driver, xv, cv = "egress", x.cost.egress, c.egress
        else:
            driver, xv, cv = "storage", x.cost.storage, c.storage
        tradeoffs.append(f"Although {label(x)} has lower compute cost ({_m(x.cost.compute)} vs {_m(c.compute)}), "
                         f"its {driver} cost ({_m(xv)} vs {_m(cv)}) makes its total {_m(x.total)}/month, "
                         f"higher than {_m(total)}.")
    if r.pricing_model == "spot":
        tradeoffs.append("The saving comes with interruption risk that an on-demand baseline does not carry.")
    if r.pricing_model == "reserved":
        tradeoffs.append("Reserved pricing would lose its advantage if the workload ran only part of the month.")

    best_total = top.total
    delta_pct = ((total - best_total) / best_total * 100) if best_total > 0 else Decimal(0)
    tied = rank > 1 and best_total > 0 and abs(delta_pct) < cfg.tie_threshold_pct
    if rank == 1 and len(ranked) > 1 and total > 0:
        tied = abs(ranked[1].total - total) / total * 100 < cfg.tie_threshold_pct
    parts = {"compute": c.compute, "storage": c.storage, "egress": c.egress, "ingress": c.ingress}
    driver = max(parts, key=lambda k: parts[k])
    dominant = {"component": driver, "amount": float(money(parts[driver])),
                "share_pct": float((parts[driver] / total * 100).quantize(Decimal("0.1"))) if total > 0 else 0.0}

    summary = (f"{label(rc)} is {'recommended' if rank == 1 else f'ranked #{rank}'} at {_m(total)}/month. "
               f"{summary_cmp}")
    return {"summary": summary, "reasons": reasons, "tradeoffs": tradeoffs, "warnings": warnings_for(w, rc),
            # Structured components required by Requirement FR-REC-03 / Fig. 4.3
            "dominant_driver": dominant,
            "eligibility_reason": eligibility_reason(w, r.pricing_model),
            "delta_vs_best_pct": float(delta_pct.quantize(Decimal("0.1"))),
            "effectively_tied": bool(tied)}
