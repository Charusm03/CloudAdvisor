export type UsagePattern = "steady-state" | "bursty" | "batch/scheduled" | "gpu-intensive";
export type PricingModel = "on_demand" | "spot" | "reserved";
export type ProviderName = "AWS" | "Azure" | "GCP";
export type RiskLevel = "low" | "medium" | "high";
export type BaselineKey = "aws_on_demand" | "azure_on_demand" | "gcp_on_demand" | "cheapest_on_demand";

/** Workload sent to POST /api/recommendations/preview. */
export interface WorkloadProfile {
  vcpu: number; ram_gb: number; storage_gb: number; storage_type: "SSD" | "HDD";
  monthly_data_transfer_in_gb: number; monthly_data_transfer_out_gb: number;
  usage_pattern: UsagePattern; gpu_required: boolean; gpu_type: string | null;
  expected_runtime_hours_per_month: number; interruption_tolerant: boolean; preferred_region: string;
  /** Number of GPUs; optional so analyses saved before it existed still load. */
  gpu_count?: number;
}
/** @deprecated kept so older imports keep compiling */
export type WorkloadInput = WorkloadProfile;

/** One normalised price row, as returned by GET /api/pricing. */
export interface PricingRecord {
  id: number; provider: ProviderName; region: string; instance_type: string; vcpu: number; ram_gb: number;
  gpu_type: string | null; gpu_count: number; storage_type_supported: string; pricing_model: PricingModel;
  price_per_hour: number; storage_price_per_gb_month: number; egress_price_per_gb: number; ingress_price_per_gb: number;
  interruption_risk: RiskLevel; commitment_months: number; source: string; price_snapshot_date: string;
}

export interface CostBreakdown {
  compute_cost: number; storage_cost: number; egress_cost: number; ingress_cost: number; total_monthly_cost: number;
}

export interface DominantDriver { component: "compute" | "storage" | "egress" | "ingress"; amount: number; share_pct: number }
export interface RecommendationExplanation {
  summary: string; reasons: string[]; tradeoffs: string[]; warnings: string[];
  /** Structured components (Requirement FR-REC-03); optional so older saved analyses still render. */
  dominant_driver?: DominantDriver; eligibility_reason?: string; delta_vs_best_pct?: number; effectively_tied?: boolean;
}
export type Explanation = RecommendationExplanation;

export interface SavingsEntry {
  baseline: string; baseline_cost: number; amount: number; percent: number | null; reliability_note: string | null;
}

export interface Candidate extends CostBreakdown {
  rank: number | null; provider: ProviderName; region: string; instance_type: string; vcpu: number; ram_gb: number;
  gpu_type: string | null; gpu_count: number; pricing_model: PricingModel; pricing_model_label: string;
  commitment_months: number; interruption_risk: RiskLevel;
  resource_fit_score: number; cpu_surplus: number; ram_surplus: number;
  suitability_score: number; score: number; spot_not_primary: boolean;
}

export interface Recommendation extends Candidate {
  explanation: RecommendationExplanation; warnings: string[]; savings: Record<BaselineKey, SavingsEntry | null>;
}

export interface Baseline { label: string; total_monthly_cost: number }

/** Advisory ML classification; never changes which pricing models are eligible. */
export interface Classification {
  predicted_pattern: UsagePattern; confidence: number; probabilities: Record<string, number>;
  selected_pattern: UsagePattern | null; matches_selected: boolean | null; strategy_prior: string;
  suggested_defaults: { expected_runtime_hours_per_month: number; interruption_tolerant: boolean };
  top_features: { feature: string; importance: number }[]; advisory_only: boolean;
}
export interface PricingFreshness { snapshot_date: string; age_days: number; status: "fresh" | "stale"; stale_after_days: number }
export interface RegionGroup { label: string; regions: Record<string, string[]> }
export interface PricingMeta {
  records: number; freshness: PricingFreshness | null; sources?: string[]; gpu_types: string[];
  regions: Record<string, string[]>; region_groups: Record<string, RegionGroup>;
}

export interface RecommendationResponse {
  workload: WorkloadProfile; recommendations: Recommendation[]; best_overall: Recommendation;
  cheapest_valid: Candidate; provider_comparison: Record<string, Candidate | null>; candidates: Candidate[];
  baselines: Record<BaselineKey, Baseline | null>;
  pricing_snapshot_date: string; assumptions: string[];
  classification?: Classification | null; pricing_freshness?: PricingFreshness;
}

export interface ApiErrorBody { error: string; message: string; field?: string }

export interface SavedAnalysis {
  id: string; name: string; created_at: string; workload: WorkloadProfile; result: RecommendationResponse;
}
