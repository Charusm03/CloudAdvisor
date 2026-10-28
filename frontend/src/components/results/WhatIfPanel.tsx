import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Field } from "../workload/Field";
import { toForm, toWorkload, validateForm, type FormState } from "../../services/validation";
import type { WorkloadProfile } from "../../types";

const KEYS = ["expected_runtime_hours_per_month", "monthly_data_transfer_out_gb", "storage_gb"] as const;
type Key = (typeof KEYS)[number];
const DEBOUNCE_MS = import.meta.env.MODE === "test" ? 0 : 400;

/**
 * Adjust the assumptions that move the ranking most (runtime, outbound data, storage, interruption tolerance) and see
 * the recommendation recompute automatically as each input changes (Requirement FR-UI-02), without re-running the wizard.
 */
export function WhatIfPanel({ workload, onRecompute }: { workload: WorkloadProfile; onRecompute: (w: WorkloadProfile) => Promise<void> }) {
  const [form, setForm] = useState<FormState>(() => toForm(workload));
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const first = useRef(true);
  const baseline = useRef(JSON.stringify(workload));
  const errors = validateForm(form);
  const bad = KEYS.some((k) => errors[k]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (bad) { setStatus("idle"); return; }
    const next = toWorkload(form);
    if (JSON.stringify(next) === baseline.current) return;
    setStatus("pending");
    const t = setTimeout(() => {
      onRecompute(next)
        .then(() => { baseline.current = JSON.stringify(next); setStatus("done"); setMsg("Recommendation updated."); })
        .catch((e: Error) => { setStatus("error"); setMsg(e.message); });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.expected_runtime_hours_per_month, form.monthly_data_transfer_out_gb, form.storage_gb, form.interruption_tolerant]);

  const set = (k: Key) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <section id="whatif" className="block-sm" aria-labelledby="wi-h">
      <h3 id="wi-h"><SlidersHorizontal size={18} aria-hidden="true" /> Try different assumptions</h3>
      <p className="help">Change a value and the ranking recomputes automatically. Runtime above 500 hours unlocks reserved pricing for steady workloads; interruption tolerance unlocks spot.</p>
      <div className="grid3">
        <Field id="wi-runtime" labelText="Runtime" label={null} unit="hours/month" value={form.expected_runtime_hours_per_month}
          onChange={set("expected_runtime_hours_per_month")} error={errors.expected_runtime_hours_per_month} />
        <Field id="wi-egress" labelText="Outbound data" label={null} unit="GB/month" value={form.monthly_data_transfer_out_gb}
          onChange={set("monthly_data_transfer_out_gb")} error={errors.monthly_data_transfer_out_gb} />
        <Field id="wi-storage" labelText="Storage" label={null} unit="GB" value={form.storage_gb}
          onChange={set("storage_gb")} error={errors.storage_gb} />
      </div>
      <label className="check-row">
        <input type="checkbox" checked={form.interruption_tolerant} onChange={(e) => setForm((f) => ({ ...f, interruption_tolerant: e.target.checked }))} />
        <span>This workload can tolerate interruption</span>
      </label>
      <p className="help" role="status" aria-live="polite">
        {status === "pending" ? "Recomputing…" : status === "done" || status === "error" ? msg : ""}
      </p>
    </section>
  );
}
