import { ArrowDown, ArrowUp, HardDrive, Info } from "lucide-react";
import { Field } from "./Field";
import { Segmented } from "./Choice";
import { Term, Tooltip, TERMS } from "../common/Tooltip";
import type { FormErrors, FormState } from "../../services/validation";

export function StorageNetworkStep({ form, errors, set }: { form: FormState; errors: FormErrors; set: (p: Partial<FormState>) => void }) {
  return (
    <section aria-labelledby="s2-title">
      <h2 id="s2-title" tabIndex={-1}>How much data will your workload handle?</h2>
      <p className="step-sub">Storage and network traffic can change which provider is cheapest.</p>

      <div className="panel">
        <h3>Storage</h3>
        <div className="grid2">
          <Field id="storage_gb" labelText="Storage capacity" label={null} unit="GB" icon={<HardDrive size={18} />}
            value={form.storage_gb} onChange={(v) => set({ storage_gb: v })} error={errors.storage_gb} />
          <div className="field">
            <div className="field-label"><span id="stype-label">Storage type</span></div>
            <Segmented legend="Storage type" name="storage_type" value={form.storage_type}
              options={[{ value: "SSD", label: "SSD" }, { value: "HDD", label: "HDD" }]} onChange={(v) => set({ storage_type: v })} />
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Monthly data transfer</h3>
        <div className="grid2">
          <div className="net-in">
            <Field id="in_gb" labelText="Inbound" label={<span className="field-hint">Data coming in <Term k="ingress" bare /></span>}
              unit="GB/month" icon={<ArrowDown size={18} />} value={form.monthly_data_transfer_in_gb}
              onChange={(v) => set({ monthly_data_transfer_in_gb: v })} error={errors.monthly_data_transfer_in_gb} />
          </div>
          <div className="net-out">
            <Field id="out_gb" labelText="Outbound / Egress" label={<span className="field-hint">Data going out</span>}
              unit="GB/month" icon={<ArrowUp size={18} />} value={form.monthly_data_transfer_out_gb}
              onChange={(v) => set({ monthly_data_transfer_out_gb: v })} error={errors.monthly_data_transfer_out_gb} />
          </div>
        </div>
        <div className="callout">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>Why does outbound data matter? <Tooltip label="egress">{TERMS.egress.text}</Tooltip></strong>
            <p>Cloud providers can charge differently for data leaving their infrastructure. A workload with high egress may
              therefore have a different cheapest provider than one with low network traffic.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
