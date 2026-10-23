import { describe, expect, it } from "vitest";
import { candidatesCsv } from "../lib/export";
import { egressInsight, headlineSavings, pricingModelSummary, topTags } from "../lib/derive";
import { DEMO_FORM, EMPTY_FORM, toForm, toWorkload, validateForm, validateStep } from "../services/validation";
import { gcpOnDemand, r1, r2, r3, response, responseNoEgress, workload } from "./fixtures";

describe("derived insights", () => {
  it("egressInsight picks a cheaper-compute, costlier-total candidate of another provider", () => {
    const i = egressInsight(response)!;
    expect(i.other.instance_type).toBe("n2-standard-4");
    expect(i.computeDiff).toBeCloseTo(6.9); expect(i.egressDiff).toBeCloseTo(102.6); expect(i.totalDiff).toBeCloseTo(95.7);
  });
  it("egressInsight ignores spot options that cannot be primary and same-provider candidates", () => {
    expect(egressInsight(responseNoEgress)).toBeNull();
  });
  it("topTags labels ranks 2 and 3 from the data", () => {
    expect(topTags([r1, r2, r3]).map((t) => t.label)).toEqual(["Best overall", "Flexible alternative", "Interruptible alternative"]);
    const cheaper = { ...r2, total_monthly_cost: 100 };
    expect(topTags([r1, cheaper, r3])[1].label).toBe("Lower cost alternative");
  });
  it("pricingModelSummary reports the cheapest option per model", () => {
    const s = pricingModelSummary(response);
    expect(s.find((m) => m.model === "reserved")!.cheapest!.total_monthly_cost).toBe(111.8);
    expect(s.find((m) => m.model === "spot")!.blocked).toBe(true);
    expect(s.find((m) => m.model === "on_demand")!.cheapest!.instance_type).toBe("n2-standard-4" === gcpOnDemand.instance_type ? "m5.xlarge" : "");
  });
  it("headlineSavings reads the cheapest-on-demand baseline", () => { expect(headlineSavings(r1)!.amount).toBe(53.26); });
});

describe("CSV export", () => {
  it("has a header, one line per candidate, and the pricing snapshot", () => {
    const lines = candidatesCsv(response).split("\r\n");
    expect(lines[0]).toContain("provider,region,instance"); expect(lines).toHaveLength(1 + response.candidates.length);
    expect(lines[1]).toContain("Azure,eastus,D4s_v3"); expect(lines[1]).toContain("111.8"); expect(lines[1]).toContain("2026-10-19");
  });
  it("quotes cells containing commas", () => {
    const csv = candidatesCsv({ ...response, candidates: [{ ...r1, instance_type: 'a,"b"' }] });
    expect(csv).toContain('"a,""b"""');
  });
});

describe("form validation", () => {
  it("demo form is valid and maps to the API payload", () => {
    expect(validateForm(DEMO_FORM)).toEqual({});
    expect(toWorkload(DEMO_FORM)).toEqual(workload);
  });
  it("round-trips a workload through the form", () => { expect(toWorkload(toForm(workload))).toEqual(workload); });
  it("validates per step", () => {
    expect(Object.keys(validateStep(EMPTY_FORM, 1))).toEqual(["vcpu", "ram_gb"]);
    expect(Object.keys(validateStep(EMPTY_FORM, 2))).toEqual(["storage_gb", "monthly_data_transfer_in_gb", "monthly_data_transfer_out_gb"]);
    expect(validateStep({ ...DEMO_FORM, gpu_required: true }, 3).gpu_type).toBeTruthy();
    expect(validateStep({ ...DEMO_FORM, expected_runtime_hours_per_month: "745" }, 3).expected_runtime_hours_per_month).toBeTruthy();
  });
  it("gpu-intensive requires a GPU", () => {
    expect(validateForm({ ...DEMO_FORM, usage_pattern: "gpu-intensive" }).gpu_required).toBeTruthy();
  });
});
