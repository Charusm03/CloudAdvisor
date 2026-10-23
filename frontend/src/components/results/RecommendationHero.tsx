import { ArrowDown, ShieldCheck, TrendingDown } from "lucide-react";
import { ProviderMark } from "../common/ProviderBadge";
import { PricingModelBadge } from "../common/PricingModelBadge";
import { Term } from "../common/Tooltip";
import { headlineSavings } from "../../lib/derive";
import { fitPct, usd, riskLabel } from "../../lib/format";
import type { Recommendation } from "../../types";

export function RecommendationHero({ rec }: { rec: Recommendation }) {
  const s = headlineSavings(rec);
  const fit = fitPct(rec);
  return (
    <section className="decision" id="decision" aria-labelledby="decision-title">
      <div className="decision-main">
        <div className="row gap wrap">
          <span className="badge-reco"><ShieldCheck size={14} aria-hidden="true" />Recommended</span>
          <span className="decision-kicker" id="decision-title">Advisor recommendation: best overall fit</span>
        </div>
        <div className="decision-who">
          <ProviderMark provider={rec.provider} size={52} />
          <dl className="decision-facts">
            <div><dt>Provider</dt><dd>{rec.provider}</dd></div>
            <div><dt>Instance</dt><dd>{rec.instance_type}</dd></div>
            <div><dt>Pricing model</dt><dd><PricingModelBadge model={rec.pricing_model} /></dd></div>
            <div><dt>Region</dt><dd>{rec.region}</dd></div>
          </dl>
        </div>
        <p className="decision-cost"><span className="amount">{usd(rec.total_monthly_cost)}</span><span className="per"> / month</span></p>
        {s && s.amount > 0.005 && (
          <p className="decision-save"><TrendingDown size={18} aria-hidden="true" />
            Save <strong>{usd(s.amount)} / month</strong>{s.percent !== null && ` (${s.percent}%)`} <span>vs {s.baseline}</span></p>
        )}
        {s && s.amount < -0.005 && (
          <p className="decision-note">{usd(-s.amount)} / month above the cheapest on-demand option ({s.baseline}), in exchange for the fit described below.</p>
        )}
        {s && Math.abs(s.amount) <= 0.005 && <p className="decision-note">Same cost as the cheapest on-demand option.</p>}
        <a className="btn btn-light" href="#why"><ArrowDown size={16} aria-hidden="true" />View why this was selected</a>
      </div>
      <div className="decision-side">
        <div className="meter-block">
          <div className="row between"><span><Term k="fit">Workload fit</Term></span><strong>{fit}%</strong></div>
          <div className="meter" role="img" aria-label={`Workload fit ${fit} percent`}><span style={{ width: `${fit}%` }} /></div>
        </div>
        <div className="meter-block">
          <div className="row between"><span>Interruption risk</span><strong>{riskLabel[rec.interruption_risk]}</strong></div>
          <p className="muted-sm">{rec.pricing_model === "spot" ? "Capacity can be reclaimed by the provider." : "Capacity is not reclaimed during the term."}</p>
        </div>
        {rec.pricing_model === "reserved" && <p className="muted-sm">Requires a {rec.commitment_months}-month commitment, billed for the whole month.</p>}
      </div>
    </section>
  );
}
