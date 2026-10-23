import { AlertTriangle } from "lucide-react";
import { ProviderMark } from "../common/ProviderBadge";
import { PricingModelBadge } from "../common/PricingModelBadge";
import { topTags } from "../../lib/derive";
import { fitPct, riskLabel, usd } from "../../lib/format";
import type { Recommendation } from "../../types";

export function TopRecommendations({ recs }: { recs: Recommendation[] }) {
  const tags = topTags(recs);
  const first = recs[0];
  return (
    <section id="options" className="block" aria-labelledby="top-h">
      <h2 id="top-h">Your top options</h2>
      <ol className="top3">
        {recs.map((r, i) => {
          const diff = r.total_monthly_cost - first.total_monthly_cost;
          return (
            <li key={`${r.provider}-${r.instance_type}-${r.region}-${r.pricing_model}`} className={i === 0 ? "first" : ""}>
              <div className="row between">
                <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                <span className={`tag tag-${tags[i].tone}`}>{tags[i].label}</span>
              </div>
              <div className="row gap"><ProviderMark provider={r.provider} size={30} /><div><h3>{r.provider} {r.instance_type}</h3><small>{r.region}</small></div></div>
              <p className="top-cost">{usd(r.total_monthly_cost)} <small>/ month</small></p>
              <dl className="kv">
                <div><dt>Pricing model</dt><dd><PricingModelBadge model={r.pricing_model} /></dd></div>
                <div><dt>Difference from #1</dt><dd>{i === 0 ? "Baseline for this list" : `${diff >= 0 ? "+" : "−"}${usd(Math.abs(diff))} / month`}</dd></div>
                <div><dt>Workload fit</dt><dd>{fitPct(r)}%</dd></div>
                <div><dt>Interruption risk</dt><dd>{riskLabel[r.interruption_risk]}</dd></div>
              </dl>
              <p className="top-expl">{r.explanation.summary}</p>
              {r.warnings.length > 0 && <p className="top-warn"><AlertTriangle size={15} aria-hidden="true" /><span>{r.warnings[0]}</span></p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
