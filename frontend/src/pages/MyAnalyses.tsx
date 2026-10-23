import { useState } from "react";
import { Link } from "react-router-dom";
import { FileSearch, Trash2 } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { ProviderBadge } from "../components/common/ProviderBadge";
import { useAnalysis } from "../context/AppContext";
import { fmtDate, usd } from "../lib/format";
import { headlineSavings } from "../lib/derive";

export default function MyAnalyses() {
  const { saved, remove } = useAnalysis();
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="page-pad">
      <h1 className="page-title">My analyses</h1>
      {saved.length === 0 ? (
        <EmptyState icon={<FileSearch size={30} />} title="No analyses yet"
          message="Create your first workload analysis to compare AWS, Azure, and Google Cloud."
          action={<Link to="/analysis/new" className="btn btn-primary">Start an analysis</Link>} />
      ) : (
        <>
          <p className="step-sub">Saved in this browser. Each record keeps the workload, the recommendation and the pricing snapshot it was based on.</p>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Saved analyses table">
            <table className="data">
              <thead><tr><th scope="col">Analysis name</th><th scope="col">Created</th><th scope="col">Best provider</th><th scope="col" className="num">Estimated cost</th><th scope="col" className="num">Savings</th><th scope="col">Pricing snapshot</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {saved.map((a) => {
                  const best = a.result.best_overall, s = headlineSavings(best);
                  return (
                    <tr key={a.id}>
                      <th scope="row"><Link to={`/analyses/${a.id}`}>{a.name}</Link></th>
                      <td>{fmtDate(a.created_at)}</td>
                      <td><ProviderBadge provider={best.provider} /></td>
                      <td className="num strong">{usd(best.total_monthly_cost, 0)}/month</td>
                      <td className={`num ${s && s.amount > 0.005 ? "good" : ""}`}>{s && s.amount > 0.005 && s.percent !== null ? `${s.percent}% estimated savings` : "No saving vs baseline"}</td>
                      <td>{fmtDate(a.result.pricing_snapshot_date)}</td>
                      <td className="actions">
                        {confirm === a.id
                          ? <><button type="button" className="btn btn-danger sm" onClick={() => { remove(a.id); setConfirm(null); }}>Confirm delete</button>
                              <button type="button" className="btn btn-quiet sm" onClick={() => setConfirm(null)}>Cancel</button></>
                          : <button type="button" className="icon-btn dark" aria-label={`Delete ${a.name}`} onClick={() => setConfirm(a.id)}><Trash2 size={17} aria-hidden="true" /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
