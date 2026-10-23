/** Insights derived ONLY from numbers the backend returned. Nothing here invents prices or percentages. */
import type { Candidate, PricingModel, Recommendation, RecommendationResponse, SavingsEntry } from "../types";

export interface EgressInsightData {
  other: Candidate; best: Recommendation;
  computeDiff: number;   // how much cheaper `other`'s compute is than best's (positive)
  egressDiff: number;    // how much more `other`'s egress costs than best's (positive)
  totalDiff: number;     // how much more expensive `other` is overall (positive)
}

/**
 * The egress insight is shown only when a compatible, non-blocked candidate from a DIFFERENT provider has cheaper
 * compute than the recommendation, yet a higher total, and the egress difference outweighs the compute advantage.
 */
export function egressInsight(r: RecommendationResponse): EgressInsightData | null {
  const best = r.best_overall;
  const pool = r.candidates.filter((c) => !c.spot_not_primary && c.provider !== best.provider);
  let found: EgressInsightData | null = null;
  for (const c of pool) {
    const computeDiff = best.compute_cost - c.compute_cost;
    const egressDiff = c.egress_cost - best.egress_cost;
    const totalDiff = c.total_monthly_cost - best.total_monthly_cost;
    if (computeDiff > 0.005 && egressDiff > computeDiff && totalDiff > 0) {
      if (!found || computeDiff > found.computeDiff) found = { other: c, best, computeDiff, egressDiff, totalDiff };
    }
  }
  return found;
}

export interface ModelSummary {
  model: PricingModel; count: number; cheapest: Candidate | null;
  risks: string[]; commitments: number[]; blocked: boolean;
}

export function pricingModelSummary(r: RecommendationResponse): ModelSummary[] {
  return (["on_demand", "reserved", "spot"] as PricingModel[]).map((model) => {
    const list = r.candidates.filter((c) => c.pricing_model === model);
    const cheapest = list.length ? list.reduce((a, b) => (b.total_monthly_cost < a.total_monthly_cost ? b : a)) : null;
    return {
      model, count: list.length, cheapest,
      risks: [...new Set(list.map((c) => c.interruption_risk))],
      commitments: [...new Set(list.map((c) => c.commitment_months))].sort((a, b) => a - b),
      blocked: list.length > 0 && list.every((c) => c.spot_not_primary),
    };
  });
}

export type TopTag = { label: string; tone: "primary" | "saving" | "neutral" };

/** Honest labels for ranks 2 and 3, based on what the data says rather than fixed marketing names. */
export function topTags(recs: Recommendation[]): TopTag[] {
  const first = recs[0];
  return recs.map((r, i) => {
    if (i === 0) return { label: "Best overall", tone: "primary" };
    const cheaper = r.total_monthly_cost < first.total_monthly_cost - 0.005;
    const cheapestOfRest = recs.slice(1).every((o) => o === r || o.total_monthly_cost >= r.total_monthly_cost);
    if (cheaper && cheapestOfRest) return { label: "Lower cost alternative", tone: "saving" };
    if (r.pricing_model === "on_demand") return { label: "Flexible alternative", tone: "neutral" };
    if (r.pricing_model === "spot") return { label: "Interruptible alternative", tone: "neutral" };
    return { label: "Committed alternative", tone: "neutral" };
  });
}

export function headlineSavings(r: Recommendation): SavingsEntry | null {
  return r.savings.cheapest_on_demand ?? null;
}

export function utilizationMessage(c: Candidate): string {
  if (c.cpu_surplus === 0 && c.ram_surplus === 0)
    return "Very close resource match: little capacity is being paid for but unused.";
  if (c.resource_fit_score >= 0.85)
    return "Close resource match with a small amount of headroom beyond your request.";
  return "Includes additional capacity beyond your requested workload. This increases headroom but may increase cost.";
}

export function riskText(c: Candidate): string {
  if (c.pricing_model === "spot") return `${c.interruption_risk[0].toUpperCase()}${c.interruption_risk.slice(1)} (can be interrupted)`;
  return "Low";
}

export const totalOf = (c: Candidate) => c.total_monthly_cost;
