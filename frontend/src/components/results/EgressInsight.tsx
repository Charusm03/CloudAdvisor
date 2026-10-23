import { Network } from "lucide-react";
import type { EgressInsightData } from "../../lib/derive";
import { usd } from "../../lib/format";

/** Rendered only when egressInsight() finds numbers that support the claim. */
export function EgressInsight({ insight }: { insight: EgressInsightData }) {
  const { other, best, computeDiff, egressDiff, totalDiff } = insight;
  const max = Math.max(computeDiff, egressDiff);
  return (
    <section id="egress" className="insight" aria-labelledby="egress-h">
      <div className="row gap"><Network size={22} aria-hidden="true" /><h2 id="egress-h">Network costs changed the result</h2></div>
      <p>
        {other.provider} {other.instance_type} ({other.region}) has the lower compute price, but its estimated outbound data charges
        make the total {usd(totalDiff)} / month higher than {best.provider} {best.instance_type}.
      </p>
      <div className="vs">
        <div><span>Compute difference</span><div className="vs-bar saving"><span style={{ width: `${(computeDiff / max) * 100}%` }} /></div><strong>{usd(computeDiff)} cheaper at {other.provider}</strong></div>
        <div><span>Egress difference</span><div className="vs-bar caution"><span style={{ width: `${(egressDiff / max) * 100}%` }} /></div><strong>{usd(egressDiff)} more at {other.provider}</strong></div>
      </div>
    </section>
  );
}
