import { useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { fmtDate } from "../../lib/format";
import type { RecommendationResponse } from "../../types";

export function AssumptionsPanel({ data }: { data: RecommendationResponse }) {
  const [open, setOpen] = useState(false);
  const w = data.workload;
  const models = [...new Set(data.candidates.map((c) => c.pricing_model_label))];
  const regions = [...new Set(data.candidates.map((c) => c.region))];
  return (
    <section id="assumptions" className="block" aria-labelledby="as-h">
      <h2 id="as-h"><ListChecks size={20} aria-hidden="true" /> Calculation assumptions</h2>
      <ul className="chips-static" aria-label="Key assumptions">
        <li>Currency: USD</li><li>Runtime: {w.expected_runtime_hours_per_month} hours/month</li>
        <li>Pricing snapshot: {fmtDate(data.pricing_snapshot_date)}{data.pricing_freshness ? ` (${data.pricing_freshness.age_days} days old${data.pricing_freshness.status === "stale" ? ", stale" : ""})` : ""}</li><li>Taxes excluded</li>
      </ul>
      <button type="button" className="btn btn-quiet" aria-expanded={open} aria-controls="assume-body" onClick={() => setOpen((o) => !o)}>
        <ChevronDown size={16} aria-hidden="true" className={open ? "flip" : ""} />{open ? "Hide all assumptions" : "Show all assumptions"}
      </button>
      {open && (
        <div id="assume-body" className="assume-body">
          <ul>
            <li>Pricing models included in this comparison: {models.join(", ")}.</li>
            <li>Regions compared: {regions.join(", ")}.</li>
            {data.assumptions.map((a) => <li key={a}>{a}</li>)}
          </ul>
          <div className="callout"><div><strong>Why this matters</strong>
            <p>Cloud provider pricing changes over time. These results are estimates based on the pricing snapshot shown above.</p></div></div>
        </div>
      )}
    </section>
  );
}
