import { Cpu, MemoryStick } from "lucide-react";
import { Field } from "./Field";
import { ResourceSummary } from "./ResourceSummary";
import { Term } from "../common/Tooltip";
import type { FormErrors, FormState } from "../../services/validation";

export function ComputeStep({ form, errors, set }: { form: FormState; errors: FormErrors; set: (p: Partial<FormState>) => void }) {
  return (
    <section aria-labelledby="s1-title">
      <h2 id="s1-title" tabIndex={-1}>What are you planning to run?</h2>
      <p className="step-sub">Start with the compute resources your workload needs.</p>
      <div className="split">
        <div className="panel">
          <div className="grid2">
            <Field id="vcpu" labelText="vCPU" label={<Term k="vcpu" bare />} unit="vCPU"
              icon={<Cpu size={18} />} value={form.vcpu} onChange={(v) => set({ vcpu: v })} error={errors.vcpu} />
            <Field id="ram_gb" labelText="RAM" label={<Term k="ram" bare />} unit="GB"
              icon={<MemoryStick size={18} />} value={form.ram_gb} onChange={(v) => set({ ram_gb: v })} error={errors.ram_gb} />
          </div>
          <p className="help">These are the minimum resources your workload requires. We only consider instances that meet or exceed them.</p>
        </div>
        <ResourceSummary form={form} />
      </div>
    </section>
  );
}
