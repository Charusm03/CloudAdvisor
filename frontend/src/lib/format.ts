import type { Candidate, PricingModel, RiskLevel } from "../types";

export const usd = (n: number, digits = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const usd0 = (n: number) => usd(n, 0);
export const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`;
export const fitPct = (c: { resource_fit_score: number }) => Math.round(c.resource_fit_score * 100);
export const providerLabel = (c: Pick<Candidate, "provider" | "instance_type" | "region">) =>
  `${c.provider} ${c.instance_type} (${c.region})`;
export const modelLabel: Record<PricingModel, string> = {
  on_demand: "On-Demand", reserved: "Reserved/Committed", spot: "Spot/Preemptible",
};
export const riskLabel: Record<RiskLevel, string> = { low: "Low", medium: "Medium", high: "High" };
export const providerFull: Record<string, string> = { AWS: "Amazon Web Services", Azure: "Microsoft Azure", GCP: "Google Cloud" };
export const gpuLabel = (g: string) => g.replace(/^NVIDIA\s+/i, "");
export const fmtDate = (iso: string) => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
};
