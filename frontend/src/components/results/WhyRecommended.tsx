import { AlertTriangle, CheckCircle2, Cpu, ShieldCheck } from "lucide-react";
import { usd } from "../../lib/format";
import type { Classification, Recommendation } from "../../types";

const PATTERN: Record<string, string> = { "steady-state": "steady-state", bursty: "bursty", "batch/scheduled": "batch / scheduled", "gpu-intensive": "GPU-intensive" };
const COMPONENT: Record<string, string> = { compute: "Compute", storage: "Storage", egress: "Outbound data", ingress: "Inbound data" };

export function WhyRecommended({ rec, classification }: { rec: Recommendation; classification?: Classification | null }) {
  const { tradeoffs, warnings, summary, eligibility_reason, dominant_driver, effectively_tied } = rec.explanation;
  // Spec: 3-5 bullets. Drop the generic risk line (already shown in the hero) when there are more than five.
  const all = rec.explanation.reasons;
  const reasons = all.length > 5 ? all.filter((r) => !r.startsWith("Interruption risk:")).slice(0, 5) : all;
  return (
    <section id="why" className="block" aria-labelledby="why-h">
      <h2 id="why-h">Why we recommend this</h2>
      <p className="lead-sm">{summary}</p>
      <ul className="checks">
        {reasons.map((r) => <li key={r}><CheckCircle2 size={18} aria-hidden="true" /><span>{r}</span></li>)}
      </ul>
      {(eligibility_reason || dominant_driver) && (
        <ul className="checks" aria-label="How this option qualified">
          {eligibility_reason && <li><ShieldCheck size={18} aria-hidden="true" /><span><strong>Eligibility:</strong> {eligibility_reason}</span></li>}
          {dominant_driver && <li><ShieldCheck size={18} aria-hidden="true" /><span><strong>Biggest cost driver:</strong> {COMPONENT[dominant_driver.component]} ({usd(dominant_driver.amount)}, {Math.round(dominant_driver.share_pct)}% of the total).{effectively_tied ? " This option is effectively tied with the next one." : ""}</span></li>}
        </ul>
      )}
      {(tradeoffs.length > 0 || warnings.length > 0) && (
        <ul className="checks caution" aria-label="Trade-offs and warnings">
          {[...tradeoffs, ...warnings].map((t) => <li key={t}><AlertTriangle size={18} aria-hidden="true" /><span><span className="sr-only">Trade-off: </span>{t}</span></li>)}
        </ul>
      )}
      {classification && (
        <div className="callout" aria-label="Workload classifier">
          <Cpu size={18} aria-hidden="true" />
          <div>
            <strong>Workload classifier (advisory)</strong>
            <p>The model reads this profile as <strong>{PATTERN[classification.predicted_pattern] ?? classification.predicted_pattern}</strong> ({Math.round(classification.confidence * 100)}% confidence)
              {classification.matches_selected === false && classification.selected_pattern
                ? `, while you selected ${PATTERN[classification.selected_pattern] ?? classification.selected_pattern}. Your selection was used.`
                : classification.matches_selected ? ", which matches your selection." : "."} {classification.strategy_prior}</p>
            <p className="help">It never changes which pricing models are eligible.</p>
          </div>
        </div>
      )}
    </section>
  );
}
