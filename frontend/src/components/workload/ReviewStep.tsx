import { ArrowRight, Pencil } from "lucide-react";
import { gpuLabel, num } from "../../lib/format";
import type { FormState } from "../../services/validation";

type Go = (s: 1 | 2 | 3) => void;
const GROUP_NAMES: Record<string, string> = { us: "United States (all providers)", europe: "Europe (all providers)" };
const regionText = (r: string) => (r === "any" ? "Any supported region" : GROUP_NAMES[r] ?? r);

function Row({ title, step, go, children }: { title: string; step: 1 | 2 | 3; go: Go; children: React.ReactNode }) {
  return (
    <div className="review-row">
      <div><h3>{title}</h3><p>{children}</p></div>
      <button type="button" className="link" onClick={() => go(step)} aria-label={`Edit ${title}`}><Pencil size={14} aria-hidden="true" />Edit</button>
    </div>
  );
}

export function ReviewStep({ form, go, onSubmit, busy }: { form: FormState; go: Go; onSubmit: () => void; busy: boolean }) {
  const patternLabel = { "steady-state": "Steady-state", bursty: "Bursty", "batch/scheduled": "Batch / Scheduled", "gpu-intensive": "GPU-intensive" }[form.usage_pattern];
  return (
    <section aria-labelledby="s4-title">
      <h2 id="s4-title" tabIndex={-1}>Review your workload</h2>
      <p className="step-sub">Check these details, then run the comparison.</p>
      <div className="panel review">
        <Row title="Compute" step={1} go={go}>{num(Number(form.vcpu))} vCPU<br />{num(Number(form.ram_gb))} GB RAM</Row>
        <Row title="Storage" step={2} go={go}>{num(Number(form.storage_gb))} GB {form.storage_type}</Row>
        <Row title="Network" step={2} go={go}>{num(Number(form.monthly_data_transfer_in_gb))} GB inbound<br />{num(Number(form.monthly_data_transfer_out_gb))} GB outbound</Row>
        <Row title="Usage" step={3} go={go}>{patternLabel}</Row>
        <Row title="Runtime" step={3} go={go}>{num(Number(form.expected_runtime_hours_per_month))} hours/month</Row>
        <Row title="Interruption" step={3} go={go}>{form.interruption_tolerant ? "Tolerated (spot-style capacity allowed)" : "Not tolerated"}</Row>
        <Row title="GPU" step={3} go={go}>{form.gpu_required ? `${Number(form.gpu_count) || 1} × ${gpuLabel(form.gpu_type)}` : "None"}</Row>
        <Row title="Region" step={3} go={go}>{regionText(form.preferred_region)}</Row>
      </div>
      <div className="row end"><button type="button" className="btn btn-primary btn-lg" onClick={onSubmit} disabled={busy}>Compare Cloud Options <ArrowRight size={18} aria-hidden="true" /></button></div>
    </section>
  );
}
