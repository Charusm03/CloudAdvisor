import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Recommendation } from "../../types";

export function WhyRecommended({ rec }: { rec: Recommendation }) {
  const { tradeoffs, warnings, summary } = rec.explanation;
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
      {(tradeoffs.length > 0 || warnings.length > 0) && (
        <ul className="checks caution" aria-label="Trade-offs and warnings">
          {[...tradeoffs, ...warnings].map((t) => <li key={t}><AlertTriangle size={18} aria-hidden="true" /><span><span className="sr-only">Trade-off: </span>{t}</span></li>)}
        </ul>
      )}
    </section>
  );
}
