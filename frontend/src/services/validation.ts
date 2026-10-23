import type { UsagePattern, WorkloadProfile } from "../types";

export interface FormState {
  vcpu: string; ram_gb: string; storage_gb: string; storage_type: "SSD" | "HDD";
  monthly_data_transfer_in_gb: string; monthly_data_transfer_out_gb: string;
  usage_pattern: UsagePattern; expected_runtime_hours_per_month: string; interruption_tolerant: boolean;
  gpu_required: boolean; gpu_type: string; preferred_region: string;
}
export type FormErrors = Partial<Record<keyof FormState, string>>;

export const MAX_RUNTIME = 744;

export const EMPTY_FORM: FormState = {
  vcpu: "", ram_gb: "", storage_gb: "", storage_type: "SSD", monthly_data_transfer_in_gb: "",
  monthly_data_transfer_out_gb: "", usage_pattern: "steady-state", expected_runtime_hours_per_month: "720",
  interruption_tolerant: false, gpu_required: false, gpu_type: "", preferred_region: "any",
};

/** Realistic demo workload (spec §51). */
export const DEMO_FORM: FormState = {
  ...EMPTY_FORM, vcpu: "4", ram_gb: "16", storage_gb: "200", monthly_data_transfer_in_gb: "100",
  monthly_data_transfer_out_gb: "1000",
};

export type StepId = 1 | 2 | 3 | 4 | 5;
/** Which fields belong to which wizard step; used for per-step validation. */
export const STEP_FIELDS: Record<1 | 2 | 3, (keyof FormState)[]> = {
  1: ["vcpu", "ram_gb"],
  2: ["storage_gb", "storage_type", "monthly_data_transfer_in_gb", "monthly_data_transfer_out_gb"],
  3: ["usage_pattern", "expected_runtime_hours_per_month", "interruption_tolerant", "gpu_required", "gpu_type", "preferred_region"],
};

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function validateForm(f: FormState): FormErrors {
  const e: FormErrors = {};
  const pos = (k: keyof FormState, label: string) => {
    const v = num(f[k] as string);
    if (Number.isNaN(v)) e[k] = `${label} is required`;
    else if (v <= 0) e[k] = `${label} must be greater than 0`;
  };
  const nonNeg = (k: keyof FormState, label: string) => {
    const v = num(f[k] as string);
    if (Number.isNaN(v)) e[k] = `${label} is required`;
    else if (v < 0) e[k] = `${label} must be 0 or more`;
  };
  pos("vcpu", "vCPU"); pos("ram_gb", "RAM");
  nonNeg("storage_gb", "Storage"); nonNeg("monthly_data_transfer_in_gb", "Inbound transfer");
  nonNeg("monthly_data_transfer_out_gb", "Outbound transfer");
  const rt = num(f.expected_runtime_hours_per_month);
  if (Number.isNaN(rt)) e.expected_runtime_hours_per_month = "Runtime is required";
  else if (rt <= 0) e.expected_runtime_hours_per_month = "Runtime must be greater than 0";
  else if (rt > MAX_RUNTIME) e.expected_runtime_hours_per_month = `Runtime must be at most ${MAX_RUNTIME} hours`;
  if (f.gpu_required && !f.gpu_type) e.gpu_type = "Choose a GPU type";
  if (f.usage_pattern === "gpu-intensive" && !f.gpu_required) e.gpu_required = "A GPU-intensive workload requires a GPU";
  if (!f.preferred_region.trim()) e.preferred_region = "Choose a region, or 'Any supported region'";
  return e;
}

export function validateStep(f: FormState, step: 1 | 2 | 3): FormErrors {
  const all = validateForm(f);
  const out: FormErrors = {};
  for (const k of STEP_FIELDS[step]) if (all[k]) out[k] = all[k];
  return out;
}

export function toWorkload(f: FormState): WorkloadProfile {
  return {
    vcpu: Number(f.vcpu), ram_gb: Number(f.ram_gb), storage_gb: Number(f.storage_gb), storage_type: f.storage_type,
    monthly_data_transfer_in_gb: Number(f.monthly_data_transfer_in_gb),
    monthly_data_transfer_out_gb: Number(f.monthly_data_transfer_out_gb),
    usage_pattern: f.usage_pattern, gpu_required: f.gpu_required, gpu_type: f.gpu_required ? f.gpu_type : null,
    expected_runtime_hours_per_month: Number(f.expected_runtime_hours_per_month),
    interruption_tolerant: f.interruption_tolerant, preferred_region: f.preferred_region.trim(),
  };
}

export function toForm(w: WorkloadProfile): FormState {
  return {
    vcpu: String(w.vcpu), ram_gb: String(w.ram_gb), storage_gb: String(w.storage_gb), storage_type: w.storage_type,
    monthly_data_transfer_in_gb: String(w.monthly_data_transfer_in_gb),
    monthly_data_transfer_out_gb: String(w.monthly_data_transfer_out_gb),
    usage_pattern: w.usage_pattern, expected_runtime_hours_per_month: String(w.expected_runtime_hours_per_month),
    interruption_tolerant: w.interruption_tolerant, gpu_required: w.gpu_required, gpu_type: w.gpu_type ?? "",
    preferred_region: w.preferred_region,
  };
}
