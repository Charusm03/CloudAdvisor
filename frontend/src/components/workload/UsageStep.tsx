import { Activity, CalendarClock, Cpu, Lock, PiggyBank, TrendingUp } from "lucide-react";
import { ChoiceCard, Segmented } from "./Choice";
import { Field } from "./Field";
import { RegionStep } from "./RegionStep";
import { Term } from "../common/Tooltip";
import { usePricing } from "../../context/AppContext";
import { gpuLabel } from "../../lib/format";
import { MAX_RUNTIME, type FormErrors, type FormState } from "../../services/validation";
import type { UsagePattern } from "../../types";

const PATTERNS: { v: UsagePattern; title: string; text: string; icon: typeof Activity }[] = [
  { v: "steady-state", title: "Steady-state", text: "Runs consistently for most of the month.", icon: Activity },
  { v: "bursty", title: "Bursty", text: "Usage changes significantly over time.", icon: TrendingUp },
  { v: "batch/scheduled", title: "Batch / Scheduled", text: "Runs at specific times or in jobs.", icon: CalendarClock },
  { v: "gpu-intensive", title: "GPU-intensive", text: "Requires GPU acceleration.", icon: Cpu },
];
const QUICK = [160, 320, 720];

export function UsageStep({ form, errors, set }: { form: FormState; errors: FormErrors; set: (p: Partial<FormState>) => void }) {
  const { gpuTypes, loading } = usePricing();
  const rt = Number(form.expected_runtime_hours_per_month);
  const custom = !QUICK.includes(rt);
  return (
    <section aria-labelledby="s3-title">
      <h2 id="s3-title" tabIndex={-1}>How will this workload behave?</h2>
      <p className="step-sub">This decides which pricing models make sense for you.</p>

      <fieldset className="choices choices4">
        <legend className="sr-only">Usage pattern</legend>
        {PATTERNS.map(({ v, title, text, icon: I }) => (
          <ChoiceCard key={v} name="usage" value={v} checked={form.usage_pattern === v} icon={<I size={22} />} title={title} text={text}
            onChange={() => set(v === "gpu-intensive" ? { usage_pattern: v, gpu_required: true } : { usage_pattern: v })} />
        ))}
      </fieldset>

      <div className="panel">
        <h3>Expected monthly runtime</h3>
        <div className="runtime">
          <Field id="runtime" labelText="Expected monthly runtime" label={null} unit="hours/month" value={form.expected_runtime_hours_per_month}
            onChange={(v) => set({ expected_runtime_hours_per_month: v })} error={errors.expected_runtime_hours_per_month}
            help={`Maximum: ${MAX_RUNTIME} hours/month`} />
          <div className="quick" role="group" aria-label="Quick runtime presets">
            {QUICK.map((h) => (
              <button type="button" key={h} className={`chip ${rt === h ? "on" : ""}`} aria-pressed={rt === h}
                onClick={() => set({ expected_runtime_hours_per_month: String(h) })}>{h} h</button>
            ))}
            <button type="button" className={`chip ${custom ? "on" : ""}`} aria-pressed={custom}
              onClick={() => document.getElementById("runtime")?.focus()}>Custom</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Can this workload be interrupted?</h3>
        <fieldset className="choices choices2">
          <legend className="sr-only">Can this workload be interrupted?</legend>
          <ChoiceCard name="interrupt" value="no" checked={!form.interruption_tolerant} onChange={() => set({ interruption_tolerant: false })}
            icon={<Lock size={20} />} title="No: reliability is important" text="We will not recommend capacity that can be taken away." />
          <ChoiceCard name="interrupt" value="yes" checked={form.interruption_tolerant} onChange={() => set({ interruption_tolerant: true })}
            icon={<PiggyBank size={20} />} title="Yes: lower cost is worth interruption risk" text="Spot-style capacity becomes a candidate." />
        </fieldset>
        <p className="help"><Term k="spot">Spot</Term>/<Term k="preemptible">Preemptible</Term> pricing can be cheaper but may be interrupted.</p>
      </div>

      <div className="panel">
        <h3 id="gpu-q">Does this workload require a GPU?</h3>
        <Segmented legend="Does this workload require a GPU?" name="gpu" value={form.gpu_required ? "yes" : "no"}
          options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]}
          onChange={(v) => set(v === "yes" ? { gpu_required: true }
            : { gpu_required: false, gpu_type: "", usage_pattern: form.usage_pattern === "gpu-intensive" ? "steady-state" : form.usage_pattern })} />
        {form.gpu_required && (
          <div className="gpu-types">
            <fieldset className="choices choices4">
              <legend>GPU type</legend>
              {gpuTypes.map((g) => (
                <label key={g} className={`pill big ${form.gpu_type === g ? "on" : ""}`}>
                  <input type="radio" name="gpu_type" value={g} checked={form.gpu_type === g} onChange={() => set({ gpu_type: g })} />
                  <span>{gpuLabel(g)}</span>
                </label>
              ))}
            </fieldset>
            {!loading && gpuTypes.length === 0 && <p className="field-error">GPU options couldn't be loaded from the pricing data.</p>}
            {errors.gpu_type && <p className="field-error">{errors.gpu_type}</p>}
          </div>
        )}
        {errors.gpu_required && <p className="field-error">{errors.gpu_required}</p>}
      </div>

      <RegionStep form={form} errors={errors} set={set} />
    </section>
  );
}
