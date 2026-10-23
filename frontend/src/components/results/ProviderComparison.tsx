import { Check } from "lucide-react";
import { ProviderMark } from "../common/ProviderBadge";
import { PricingModelBadge } from "../common/PricingModelBadge";
import { providerFull, usd } from "../../lib/format";
import type { ProviderName, RecommendationResponse } from "../../types";

export function ProviderComparison({ data }: { data: RecommendationResponse }) {
  const base = data.baselines.cheapest_on_demand?.total_monthly_cost ?? null;
  const entries = (["AWS", "Azure", "GCP"] as ProviderName[]).map((p) => [p, data.provider_comparison[p] ?? null] as const);
  const max = Math.max(1, ...entries.map(([, c]) => c?.total_monthly_cost ?? 0));
  return (
    <section id="providers" className="block" aria-labelledby="prov-h">
      <h2 id="prov-h">Compare providers</h2>
      <p className="lead-sm">The best compatible option from each provider, ranked by the same rules.</p>
      <ul className="prov-compare">
        {entries.map(([p, c]) => {
          const isBest = data.best_overall.provider === p;
          const sav = c && base ? ((base - c.total_monthly_cost) / base) * 100 : null;
          return (
            <li key={p} className={`pc ${isBest ? "is-best" : ""} ${c ? "" : "is-empty"}`}>
              <div className="row between">
                <div className="row gap"><ProviderMark provider={p} size={34} /><h3>{providerFull[p]}</h3></div>
                {isBest && <span className="badge-reco sm"><Check size={12} aria-hidden="true" />Recommended</span>}
              </div>
              {c ? (
                <>
                  <p className="pc-cost">{usd(c.total_monthly_cost)} <small>/ month</small></p>
                  <div className="pc-bar" aria-hidden="true"><span style={{ width: `${(c.total_monthly_cost / max) * 100}%` }} /></div>
                  <dl className="kv">
                    <div><dt>Best compatible</dt><dd>{c.instance_type}</dd></div>
                    <div><dt>Pricing</dt><dd><PricingModelBadge model={c.pricing_model} /></dd></div>
                    <div><dt>Region</dt><dd>{c.region}</dd></div>
                    <div><dt>Potential savings</dt><dd>{sav !== null && sav > 0.05 ? `${sav.toFixed(1)}% vs cheapest on-demand` : "None vs cheapest on-demand"}</dd></div>
                  </dl>
                </>
              ) : <p className="muted">No compatible option from this provider for your requirements.</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
