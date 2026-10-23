import type { ApiErrorBody, PricingRecord, RecommendationResponse, WorkloadProfile } from "../types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000";

export class ApiError extends Error {
  kind: string;
  field?: string;
  constructor(kind: string, message: string, field?: string) {
    super(message);
    this.kind = kind;
    this.field = field;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError("network", "Could not reach the advisor service. Check that the backend is running.");
  }
  let body: unknown = null;
  try { body = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) {
    const e = body as Partial<ApiErrorBody> | null;
    throw new ApiError(e?.error ?? "server_error", e?.message ?? "The advisor service returned an error.", e?.field);
  }
  return body as T;
}

export function analyzeWorkload(workload: WorkloadProfile): Promise<RecommendationResponse> {
  return request<RecommendationResponse>("/api/recommendations/preview", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workload),
  });
}

export function fetchPricing(): Promise<PricingRecord[]> {
  return request<PricingRecord[]>("/api/pricing");
}
