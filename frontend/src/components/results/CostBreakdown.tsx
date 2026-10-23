import type { CostBreakdown as CB } from "../../types";
import { Term } from "../common/Tooltip";
import { usd } from "../../lib/format";

export function CostBreakdown({ cost }: { cost: CB }) {
  const parts = [
    { key: "compute", label: "Compute", v: cost.compute_cost },
    { key: "storage", label: "Storage", v: cost.storage_cost },
    { key: "egress", label: "Outbound data", v: cost.egress_cost, term: "egress" as const },
    { key: "ingress", label: "Inbound data", v: cost.ingress_cost, term: "ingress" as const },
  ];
  const total = cost.total_monthly_cost || 1;
  const top = parts.reduce((a, b) => (b.v > a.v ? b : a));
  return (
    <section id="costs" className="block" aria-labelledby="cost-h">
      <h2 id="cost-h">What drives the cost?</h2>
      <p className="lead-sm">
        {top.v > 0 ? <><strong>{top.label}</strong> is the largest part of the bill ({Math.round((top.v / total) * 100)}% of the monthly total).</> : "No cost components were returned."}
      </p>
      <div className="stack" role="img" aria-label={parts.map((p) => `${p.label} ${usd(p.v)}`).join(", ")}>
        {parts.filter((p) => p.v > 0).map((p) => <span key={p.key} className={`seg-${p.key}`} style={{ width: `${(p.v / total) * 100}%` }} />)}
      </div>
      <table className="cost-table">
        <caption className="sr-only">Monthly cost breakdown</caption>
        <thead><tr><th scope="col">Component</th><th scope="col" className="num">Share</th><th scope="col" className="num">USD / month</th></tr></thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.key}>
              <th scope="row"><span className={`swatch seg-${p.key}`} aria-hidden="true" />{p.term ? <Term k={p.term}>{p.label}</Term> : p.label}</th>
              <td className="num">{Math.round((p.v / total) * 100)}%</td>
              <td className="num">{usd(p.v)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th scope="row">Total</th><td className="num">100%</td><td className="num">{usd(cost.total_monthly_cost)} / month</td></tr></tfoot>
      </table>
    </section>
  );
}
