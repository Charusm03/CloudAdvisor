"""Ranking pipeline: compatibility -> interruption constraint -> cost -> fit -> pricing-model suitability.

Sort key: (spot_not_primary, -score, total, provider, region, instance, model)
  * spot_not_primary: spot candidates for non-interruption-tolerant workloads sort AFTER every other
    candidate, so they can appear as alternatives but are never the primary recommendation.
  * score: see ScoringConfig (all weights are in backend/config.py).
"""
from dataclasses import dataclass
from decimal import Decimal

from backend.config import DEFAULT_COST_CONFIG, DEFAULT_SCORING_CONFIG
from backend.services.candidate_service import Fit, find_candidates, resource_fit
from backend.services.cost_engine import CostBreakdown, compute_cost, money
from backend.services.explanation_service import explain, warnings_for
from backend.utils.constants import BASELINE_KEYS, MODEL_LABELS


class NoCompatibleCandidates(Exception):
    pass


@dataclass(frozen=True)
class RankedCandidate:
    rec: object
    cost: CostBreakdown
    fit: Fit
    cost_score: Decimal
    suitability: Decimal
    interruption_penalty: Decimal
    commitment_penalty: Decimal
    score: Decimal
    spot_not_primary: bool

    @property
    def total(self):
        return self.cost.total


def suitability_of(w, rec, cfg=DEFAULT_SCORING_CONFIG):
    if rec.pricing_model == "spot" and not w.interruption_tolerant:
        return Decimal(0)
    return cfg.suitability[w.usage_pattern][rec.pricing_model]


def _cost_score(cheapest, total):
    if total == 0:
        return Decimal(1)
    return cheapest / total


def rank_candidates(w, cands, cost_cfg=DEFAULT_COST_CONFIG, cfg=DEFAULT_SCORING_CONFIG):
    costed = [(r, compute_cost(w, r, cost_cfg)) for r in cands]
    cheapest = min(c.total for _, c in costed)
    out = []
    for r, c in costed:
        fit = resource_fit(w, r)
        cs = _cost_score(cheapest, c.total)
        suit = suitability_of(w, r, cfg)
        ipen = cfg.interruption_penalty[r.interruption_risk] if r.pricing_model == "spot" else Decimal(0)
        cpen = cfg.bursty_commitment_penalty if (r.pricing_model == "reserved" and w.usage_pattern == "bursty") else Decimal(0)
        score = cfg.w_cost * cs + cfg.w_fit * fit.score + cfg.w_suitability * suit - ipen - cpen
        blocked = r.pricing_model == "spot" and not w.interruption_tolerant
        out.append(RankedCandidate(r, c, fit, cs, suit, ipen, cpen, score, blocked))
    out.sort(key=lambda x: (x.spot_not_primary, -x.score, x.total,
                            x.rec.provider, x.rec.region, x.rec.instance_type, x.rec.pricing_model))
    return out


def compute_baselines(ranked):
    """A/B/C: cheapest compatible on-demand option of that provider; D: cheapest on-demand overall."""
    od = [x for x in ranked if x.rec.pricing_model == "on_demand"]

    def cheapest(items):
        return min(items, key=lambda x: (x.total, x.rec.region, x.rec.instance_type)) if items else None
    return {
        "aws_on_demand": cheapest([x for x in od if x.rec.provider == "AWS"]),
        "azure_on_demand": cheapest([x for x in od if x.rec.provider == "Azure"]),
        "gcp_on_demand": cheapest([x for x in od if x.rec.provider == "GCP"]),
        "cheapest_on_demand": cheapest(od),
    }


def savings(baseline_total, total):
    amount = baseline_total - total
    pct = amount / baseline_total * 100 if baseline_total > 0 else None
    return amount, pct


def _f(d):
    return float(money(d))


def candidate_to_dict(rc, rank=None):
    r, c = rc.rec, rc.cost
    return {
        "rank": rank, "provider": r.provider, "region": r.region, "instance_type": r.instance_type,
        "vcpu": float(r.vcpu), "ram_gb": float(r.ram_gb), "gpu_type": r.gpu_type, "gpu_count": r.gpu_count,
        "pricing_model": r.pricing_model, "pricing_model_label": MODEL_LABELS[r.pricing_model],
        "commitment_months": r.commitment_months, "interruption_risk": r.interruption_risk,
        "compute_cost": _f(c.compute), "storage_cost": _f(c.storage), "egress_cost": _f(c.egress),
        "ingress_cost": _f(c.ingress), "total_monthly_cost": _f(c.total),
        "resource_fit_score": float(rc.fit.score.quantize(Decimal("0.0001"))),
        "cpu_surplus": float(rc.fit.cpu_surplus), "ram_surplus": float(rc.fit.ram_surplus),
        "suitability_score": float(rc.suitability), "score": float(rc.score.quantize(Decimal("0.0001"))),
        "spot_not_primary": rc.spot_not_primary,
    }


def _savings_block(rc, baselines):
    block = {}
    for key in BASELINE_KEYS:
        b = baselines[key]
        if b is None:
            block[key] = None
            continue
        amount, pct = savings(b.total, rc.total)
        note = None
        if rc.rec.pricing_model == "spot":
            note = f"Spot vs on-demand: lower price, but interruption risk is {rc.rec.interruption_risk}."
        elif rc.rec.pricing_model == "reserved":
            note = f"Reserved vs on-demand: requires a {rc.rec.commitment_months}-month commitment."
        block[key] = {"baseline": f"{b.rec.provider} {b.rec.instance_type} on-demand ({b.rec.region})",
                      "baseline_cost": _f(b.total), "amount": _f(amount),
                      "percent": float(pct.quantize(Decimal("0.1"))) if pct is not None else None,
                      "reliability_note": note}
    return block


def recommend(w, records, cost_cfg=DEFAULT_COST_CONFIG, cfg=DEFAULT_SCORING_CONFIG, top_n=3):
    cands = find_candidates(w, records)
    if not cands:
        raise NoCompatibleCandidates("No pricing records satisfy the requested GPU/resource requirements.")
    ranked = rank_candidates(w, cands, cost_cfg, cfg)
    baselines = compute_baselines(ranked)

    recs = []
    for i, rc in enumerate(ranked[:top_n], start=1):
        d = candidate_to_dict(rc, i)
        d["explanation"] = explain(w, rc, i, ranked, cfg)
        d["warnings"] = d["explanation"]["warnings"]
        d["savings"] = _savings_block(rc, baselines)
        recs.append(d)

    cheapest_valid = min(ranked, key=lambda x: (x.total, x.rec.provider, x.rec.region, x.rec.instance_type))
    by_provider = {}
    for rc in ranked:  # ranked order -> first hit is the provider's best option
        by_provider.setdefault(rc.rec.provider, rc)
    provider_comparison = {p: candidate_to_dict(by_provider[p]) if p in by_provider else None
                           for p in ("AWS", "Azure", "GCP")}

    snapshot = max(x.rec.price_snapshot_date for x in ranked)
    return {
        "recommendations": recs,
        "best_overall": recs[0],
        "cheapest_valid": candidate_to_dict(cheapest_valid),
        "provider_comparison": provider_comparison,
        "candidates": [candidate_to_dict(rc, i) for i, rc in enumerate(ranked, start=1)],
        "baselines": {k: (None if b is None else {
            "label": f"{b.rec.provider} {b.rec.instance_type} on-demand ({b.rec.region})",
            "total_monthly_cost": _f(b.total)}) for k, b in baselines.items()},
        "pricing_snapshot_date": snapshot,
        "assumptions": build_assumptions(w, snapshot, cost_cfg),
    }


def build_assumptions(w, snapshot, cost_cfg):
    return [
        f"Pricing snapshot: {snapshot}. Prices are illustrative/current snapshot values and may change; this is not real-time pricing.",
        "Currency: USD. Figures are estimated monthly costs, not actual bills.",
        f"Runtime assumption: {w.expected_runtime_hours_per_month.normalize():f} hours per month.",
        f"Reserved/committed capacity is billed for the full month ({cost_cfg.hours_per_month} h) regardless of runtime.",
        f"Spot interruption assumption: {cost_cfg.spot_rerun_overhead * 100:.0f}% extra compute to re-run interrupted work; "
        "exact spot price fluctuations and capacity availability are not modelled.",
        f"Network assumptions: flat per-GB rates; {w.monthly_data_transfer_out_gb.normalize():f} GB out and "
        f"{w.monthly_data_transfer_in_gb.normalize():f} GB in per month; no free tiers or volume discounts.",
        "Storage uses one per-GB-month rate per record; SSD and HDD are priced alike in this dataset.",
        "GPU instances are excluded for workloads that do not request a GPU.",
        "Not modelled: taxes, licences, load balancers, NAT, DNS, snapshots, object storage, managed services, upfront payments.",
    ]
