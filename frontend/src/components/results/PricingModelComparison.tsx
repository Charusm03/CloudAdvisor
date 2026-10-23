import { PricingModelBadge } from "../common/PricingModelBadge";
import { Term } from "../common/Tooltip";
import { pricingModelSummary } from "../../lib/derive";
import { riskLabel, usd } from "../../lib/format";
import type { PricingModel, RecommendationResponse } from "../../types";

const BEST_FOR: Record<PricingModel, string> = {
  on_demand: "Variable workloads", reserved: "Steady workloads", spot: "Interruptible workloads",
};

export function PricingModelComparison({ data }: { data: RecommendationResponse }) {
  const rows = pricingModelSummary(data);
  return (
    <section className="block-sm" aria-labelledby="pm-h">
      <h3 id="pm-h">Pricing model trade-off</h3>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Pricing model comparison table">
        <table className="data compact">
          <thead><tr><th scope="col">Pricing model</th><th scope="col" className="num">Cheapest total</th><th scope="col">Flexibility</th><th scope="col">Interruption risk</th><th scope="col">Best for</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const current = data.best_overall.pricing_model === r.model;
              const flex = r.model === "on_demand" ? "High: no commitment"
                : r.model === "reserved" ? `Medium: ${r.commitments.filter(Boolean).join("/") || "1"}-month commitment`
                : "Lower: capacity can be reclaimed";
              return (
                <tr key={r.model} className={current ? "row-best" : ""}>
                  <th scope="row">
                    <PricingModelBadge model={r.model} />
                    {r.model === "spot" && <Term k="spot" bare />}{r.model === "reserved" && <Term k="reserved" bare />}
                    {current && <span className="tag tag-primary">Recommended</span>}
                  </th>
                  <td className="num">{r.cheapest ? `${usd(r.cheapest.total_monthly_cost)} / mo` : "n/a"}</td>
                  <td>{flex}</td>
                  <td>{r.risks.length ? r.risks.map((x) => riskLabel[x as keyof typeof riskLabel]).join(", ") : "n/a"}</td>
                  <td>{BEST_FOR[r.model]}{r.blocked && <span className="note"> (alternative only: your workload isn't interruption tolerant)</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="help">Costs are the cheapest compatible option for each pricing model in this analysis, not generic percentages.</p>
    </section>
  );
}
