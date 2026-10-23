import { useMemo, useRef, useState } from "react";
import { SearchX } from "lucide-react";
import { fitPct, usd, modelLabel } from "../../lib/format";
import type { Candidate, PricingModel, RecommendationResponse } from "../../types";
import { EmptyState } from "../common/EmptyState";

type Sort = "rank" | "cost" | "fit";
const PAGE = 20;

export function CandidateTable({ data }: { data: RecommendationResponse }) {
  const [q, setQ] = useState(""); const [prov, setProv] = useState(""); const [model, setModel] = useState("");
  const [region, setRegion] = useState(""); const [sort, setSort] = useState<Sort>("rank"); const [shown, setShown] = useState(PAGE);
  const sig = `${q}|${prov}|${model}|${region}|${sort}`; const initialSig = useRef(sig);
  const base = data.baselines.cheapest_on_demand?.total_monthly_cost ?? null;
  const regions = useMemo(() => [...new Set(data.candidates.map((c) => c.region))].sort(), [data]);
  const rows = useMemo(() => {
    const out = data.candidates.filter((c) =>
      (!prov || c.provider === prov) && (!model || c.pricing_model === model) && (!region || c.region === region) &&
      (!q || `${c.instance_type} ${c.provider} ${c.region}`.toLowerCase().includes(q.toLowerCase())));
    const cmp: Record<Sort, (a: Candidate, b: Candidate) => number> = {
      rank: (a, b) => (a.rank ?? 0) - (b.rank ?? 0),
      cost: (a, b) => a.total_monthly_cost - b.total_monthly_cost,
      fit: (a, b) => b.resource_fit_score - a.resource_fit_score || a.total_monthly_cost - b.total_monthly_cost,
    };
    return [...out].sort(cmp[sort]);
  }, [data, q, prov, model, region, sort]);
  const reset = () => { setQ(""); setProv(""); setModel(""); setRegion(""); setSort("rank"); };
  return (
    <section id="all" className="block" aria-labelledby="all-h">
      <h2 id="all-h">All compatible options</h2>
      <div className="filters" role="search" aria-label="Filter candidate options">
        <label>Search<input type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Instance, provider, region" /></label>
        <label>Provider<select value={prov} onChange={(e) => { setProv(e.target.value); setShown(PAGE); }}><option value="">All providers</option><option>AWS</option><option>Azure</option><option>GCP</option></select></label>
        <label>Pricing model<select value={model} onChange={(e) => { setModel(e.target.value); setShown(PAGE); }}><option value="">All models</option>
          {(["on_demand", "reserved", "spot"] as PricingModel[]).map((m) => <option key={m} value={m}>{modelLabel[m]}</option>)}</select></label>
        <label>Region<select value={region} onChange={(e) => { setRegion(e.target.value); setShown(PAGE); }}><option value="">All regions</option>{regions.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label>Sort by<select value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="rank">Advisor rank</option><option value="cost">Lowest cost</option><option value="fit">Best fit</option></select></label>
      </div>
      <p className="help" aria-live="polite">Showing {Math.min(shown, rows.length)} of {rows.length} options.</p>
      {rows.length === 0 ? (
        <EmptyState icon={<SearchX size={28} />} title="No options match these filters" message="Try removing a filter to see more compatible options."
          action={<button type="button" className="btn btn-secondary" onClick={reset}>Clear filters</button>} />
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="All compatible options table">
          <table className="data">
            <thead><tr>{["Rank", "Provider", "Region", "Instance", "vCPU", "RAM", "Pricing model", "Compute", "Storage", "Egress", "Total", "Savings", "Fit"].map((h) =>
              <th key={h} scope="col" className={["vCPU", "RAM", "Compute", "Storage", "Egress", "Total", "Savings", "Fit"].includes(h) ? "num" : ""}>{h}</th>)}</tr></thead>
            <tbody key={sig} className={sig !== initialSig.current ? "data-body-anim" : undefined}>
              {rows.slice(0, shown).map((c) => {
                const sav = base ? ((base - c.total_monthly_cost) / base) * 100 : null;
                return (
                  <tr key={`${c.rank}`} className={c.rank === 1 ? "row-best" : ""}>
                    <td>{c.rank}</td><th scope="row">{c.provider}</th><td>{c.region}</td><td>{c.instance_type}</td>
                    <td className="num">{c.vcpu}</td><td className="num">{c.ram_gb} GB</td><td>{c.pricing_model_label}{c.spot_not_primary && <span className="note"> (alternative only)</span>}</td>
                    <td className="num">{usd(c.compute_cost)}</td><td className="num">{usd(c.storage_cost)}</td><td className="num">{usd(c.egress_cost)}</td>
                    <td className="num strong">{usd(c.total_monthly_cost)}</td>
                    <td className={`num ${sav !== null && sav > 0.05 ? "good" : ""}`}>{sav !== null && sav > 0.05 ? `${sav.toFixed(1)}%` : "n/a"}</td>
                    <td className="num">{fitPct(c)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > shown && <div className="row center"><button type="button" className="btn btn-secondary" onClick={() => setShown((s) => s + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more</button></div>}
    </section>
  );
}
