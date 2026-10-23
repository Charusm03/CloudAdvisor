import { PiggyBank } from "lucide-react";
import { usd, usd0 } from "../../lib/format";
import type { BaselineKey, Recommendation } from "../../types";

const ROWS: { key: BaselineKey; label: string }[] = [
  { key: "aws_on_demand", label: "AWS On-Demand" }, { key: "azure_on_demand", label: "Azure On-Demand" },
  { key: "gcp_on_demand", label: "GCP On-Demand" },
];

export function SavingsPanel({ rec }: { rec: Recommendation }) {
  return (
    <section id="savings" className="block-sm" aria-labelledby="sv-h">
      <h3 id="sv-h"><PiggyBank size={18} aria-hidden="true" /> Potential savings</h3>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Savings comparison table">
        <table className="data compact">
          <thead><tr><th scope="col">Compared with</th><th scope="col" className="num">Per month</th><th scope="col" className="num">Annualized (estimate)</th></tr></thead>
          <tbody>
            {ROWS.map(({ key, label }) => {
              const s = rec.savings[key];
              if (!s) return <tr key={key}><th scope="row">{label}</th><td colSpan={2} className="muted">No compatible on-demand option</td></tr>;
              const gain = s.amount > 0.005, loss = s.amount < -0.005;
              return (
                <tr key={key}>
                  <th scope="row">{label}<small className="sub">{s.baseline}</small></th>
                  <td className={`num ${gain ? "good" : loss ? "warn" : ""}`}>
                    {gain ? `Save ${usd(s.amount)}` : loss ? `${usd(-s.amount)} more` : "No difference"}{s.percent !== null && gain ? ` (${s.percent}%)` : ""}
                  </td>
                  <td className={`num ${gain ? "good" : loss ? "warn" : ""}`}>{gain ? `${usd0(s.amount * 12)} / year` : loss ? `${usd0(-s.amount * 12)} more / year` : "n/a"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="help">Annualized figures are an estimate. Assumes the workload and pricing remain unchanged for 12 months.</p>
      {rec.savings.cheapest_on_demand?.reliability_note && <p className="help warn">{rec.savings.cheapest_on_demand.reliability_note}</p>}
    </section>
  );
}
