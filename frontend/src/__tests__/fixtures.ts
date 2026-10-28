import type { Candidate, PricingRecord, Recommendation, RecommendationResponse, WorkloadProfile } from "../types";

export const workload: WorkloadProfile = {
  vcpu: 4, ram_gb: 16, storage_gb: 200, storage_type: "SSD", monthly_data_transfer_in_gb: 100, monthly_data_transfer_out_gb: 1000,
  usage_pattern: "steady-state", gpu_required: false, gpu_type: null, expected_runtime_hours_per_month: 720,
  interruption_tolerant: false, preferred_region: "any", gpu_count: 0,
};

const cand = (o: Partial<Candidate>): Candidate => ({
  rank: 1, provider: "Azure", region: "eastus", instance_type: "D4s_v3", vcpu: 4, ram_gb: 16, gpu_type: null, gpu_count: 0,
  pricing_model: "reserved", pricing_model_label: "Reserved/Committed", commitment_months: 12, interruption_risk: "low",
  compute_cost: 86.9, storage_cost: 7.5, egress_cost: 17.4, ingress_cost: 0, total_monthly_cost: 111.8,
  resource_fit_score: 1, cpu_surplus: 0, ram_surplus: 0, suitability_score: 1, score: 0.97, spot_not_primary: false, ...o,
});
const sav = (amount: number, percent: number) => ({
  baseline: "AWS m5.xlarge on-demand (us-east-1)", baseline_cost: 165.06, amount, percent, reliability_note: null });
const rec = (o: Partial<Candidate>): Recommendation => ({
  ...cand(o), explanation: {
    summary: `${o.provider ?? "Azure"} ${o.instance_type ?? "D4s_v3"} is recommended.`,
    reasons: ["Satisfies the requested 4 vCPU / 16 GB RAM (offers 4 vCPU / 16 GB).", "Estimated $111.80/month = compute $86.90 + storage $7.50 + egress $17.40 + ingress $0.00.", "Interruption risk: low."],
    tradeoffs: [], warnings: [],
    dominant_driver: { component: "compute", amount: 86.9, share_pct: 77.7 },
    eligibility_reason: "Eligible because the workload is steady-state and runs 720 h/month (at least 500 h).",
    delta_vs_best_pct: 0, effectively_tied: false,
  },
  warnings: [], savings: { cheapest_on_demand: sav(53.26, 32.3), aws_on_demand: sav(53.26, 32.3), azure_on_demand: sav(10, 8.2), gcp_on_demand: null },
});

export const r1 = rec({});
export const r2 = rec({ rank: 2, provider: "AWS", region: "us-east-1", instance_type: "m5.xlarge", pricing_model: "on_demand",
  pricing_model_label: "On-Demand", commitment_months: 0, compute_cost: 99, storage_cost: 16, egress_cost: 90, total_monthly_cost: 205, resource_fit_score: 1 });
export const r3 = rec({ rank: 3, provider: "GCP", region: "us-central1", instance_type: "n2-standard-8", vcpu: 8, ram_gb: 32,
  pricing_model: "spot", pricing_model_label: "Spot/Preemptible", commitment_months: 0, interruption_risk: "medium", spot_not_primary: true,
  compute_cost: 60, storage_cost: 20, egress_cost: 120, total_monthly_cost: 200, resource_fit_score: 0.5, cpu_surplus: 4, ram_surplus: 16 });
// Cheaper compute than the recommendation, but much higher egress and total: should trigger the egress insight.
export const gcpOnDemand = cand({ rank: 4, provider: "GCP", region: "us-central1", instance_type: "n2-standard-4", pricing_model: "on_demand",
  pricing_model_label: "On-Demand", commitment_months: 0, compute_cost: 80, storage_cost: 7.5, egress_cost: 120, total_monthly_cost: 207.5 });

export const baselines = {
  cheapest_on_demand: { label: "AWS m5.xlarge on-demand (us-east-1)", total_monthly_cost: 165.06 },
  aws_on_demand: { label: "AWS m5.xlarge on-demand (us-east-1)", total_monthly_cost: 165.06 },
  azure_on_demand: { label: "Azure D4s_v3 on-demand (eastus)", total_monthly_cost: 121.8 }, gcp_on_demand: null,
};

export const response: RecommendationResponse = {
  workload, recommendations: [r1, r2, r3], best_overall: r1, cheapest_valid: r1,
  provider_comparison: { AWS: r2, Azure: r1, GCP: gcpOnDemand }, candidates: [r1, r2, r3, gcpOnDemand], baselines,
  pricing_snapshot_date: "2026-10-19", pricing_freshness: { snapshot_date: "2026-10-19", age_days: 5, status: "fresh", stale_after_days: 30 },
  classification: { predicted_pattern: "steady-state", confidence: 0.91, probabilities: { "steady-state": 0.91, bursty: 0.05 }, selected_pattern: "steady-state",
    matches_selected: true, strategy_prior: "Steady services usually benefit from reserved/committed capacity when they run most of the month.",
    suggested_defaults: { expected_runtime_hours_per_month: 720, interruption_tolerant: false }, top_features: [{ feature: "runtime_ratio", importance: 0.18 }], advisory_only: true },
  assumptions: ["Pricing snapshot: 2026-10-19. Not real-time pricing.", "Currency: USD.", "Runtime assumption: 720 hours per month.", "Not modelled: taxes."],
};

/** No candidate with cheaper compute and higher total: egress insight must stay hidden. */
export const responseNoEgress: RecommendationResponse = {
  ...response, provider_comparison: { AWS: r2, Azure: r1, GCP: r3 }, candidates: [r1, r2, r3],
};

const rec2 = (o: Partial<PricingRecord>): PricingRecord => ({
  id: 1, provider: "AWS", region: "us-east-1", instance_type: "m5.large", vcpu: 2, ram_gb: 8, gpu_type: null, gpu_count: 0,
  storage_type_supported: "SSD|HDD", pricing_model: "on_demand", price_per_hour: 0.096, storage_price_per_gb_month: 0.08,
  egress_price_per_gb: 0.09, ingress_price_per_gb: 0, interruption_risk: "low", commitment_months: 0,
  source: "AWS EC2 pricing page (illustrative)", price_snapshot_date: "2026-10-19", ...o });

export const pricing: PricingRecord[] = [
  rec2({ id: 1 }), rec2({ id: 2, pricing_model: "spot", price_per_hour: 0.03, interruption_risk: "medium" }),
  rec2({ id: 3, provider: "Azure", region: "eastus", instance_type: "D2s_v3", source: "Azure Linux VM pricing page (illustrative)" }),
  rec2({ id: 4, provider: "GCP", region: "us-central1", instance_type: "n2-standard-2", source: "Google Compute Engine pricing page (illustrative)" }),
  rec2({ id: 5, provider: "AWS", region: "eu-west-1", instance_type: "g4dn.xlarge", vcpu: 4, ram_gb: 16, gpu_type: "NVIDIA T4", gpu_count: 1 }),
  rec2({ id: 6, provider: "GCP", region: "europe-west1", instance_type: "a2-highgpu-1g", vcpu: 12, ram_gb: 85, gpu_type: "NVIDIA A100", gpu_count: 1 }),
];

export const pricingMeta = {
  records: 6, freshness: { snapshot_date: "2026-10-19", age_days: 5, status: "fresh", stale_after_days: 30 },
  gpu_types: ["NVIDIA A100", "NVIDIA T4"], regions: { AWS: ["eu-west-1", "us-east-1"], Azure: ["eastus"], GCP: ["europe-west1", "us-central1"] },
  region_groups: {
    us: { label: "United States", regions: { AWS: ["us-east-1"], Azure: ["eastus"], GCP: ["us-central1"] } },
    europe: { label: "Europe", regions: { AWS: ["eu-west-1"], Azure: ["westeurope"], GCP: ["europe-west1"] } },
  },
};
