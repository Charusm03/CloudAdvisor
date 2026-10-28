import { useMemo, useRef, useState } from "react";
import { Database, SearchX } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { Term } from "../components/common/Tooltip";
import { usePricing } from "../context/AppContext";
import { fmtDate, gpuLabel, modelLabel } from "../lib/format";
import type { PricingModel } from "../types";

const PAGE = 30;
const price = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

export default function PricingData() {
  const { records, loading, error, retry, snapshotDate, freshness } = usePricing();
  const [prov, setProv] = useState(""); const [region, setRegion] = useState(""); const [model, setModel] = useState("");
  const [q, setQ] = useState(""); const [shown, setShown] = useState(PAGE);
  const regions = useMemo(() => [...new Set(records.filter((r) => !prov || r.provider === prov).map((r) => r.region))].sort(), [records, prov]);
  const rows = useMemo(() => records.filter((r) => (!prov || r.provider === prov) && (!region || r.region === region) &&
    (!model || r.pricing_model === model) && (!q || r.instance_type.toLowerCase().includes(q.toLowerCase()))), [records, prov, region, model, q]);
  const sig = `${q}|${prov}|${region}|${model}`; const initialSig = useRef(sig);
  const sources = [...new Set(records.map((r) => r.source))];
  const reset = () => { setProv(""); setRegion(""); setModel(""); setQ(""); };
  return (
    <div className="page-pad">
      <h1 className="page-title">Pricing data</h1>
      <p className="step-sub">View the normalized pricing records used by the advisor.</p>
      <div className="panel meta-panel">
        <div><strong>Snapshot date</strong><p>{snapshotDate ? fmtDate(snapshotDate) : "Loading…"} <Term k="snapshot" bare />
          {freshness && <small className="sub">{freshness.age_days} days old · {freshness.status === "stale" ? `stale (older than ${freshness.stale_after_days} days)` : "fresh"}</small>}</p></div>
        <div><strong>Data source</strong>{sources.length ? <ul>{sources.map((s) => <li key={s}>{s}</li>)}</ul> : <p>Loading…</p>}</div>
        <p className="notice">This is a dated snapshot, not live pricing. Prices change and the figures can differ from current provider rates.</p>
      </div>

      {error && <ErrorState title="Pricing data couldn't be loaded" message="The advisor service didn't respond. Check that the backend is running, then try again."
        actions={<button type="button" className="btn btn-primary" onClick={retry}>Try again</button>} />}
      {loading && !error && <p className="help" aria-live="polite">Loading pricing records…</p>}

      {!error && !loading && (
        <>
          <div className="filters" role="search" aria-label="Filter pricing records">
            <label>Provider<select value={prov} onChange={(e) => { setProv(e.target.value); setRegion(""); setShown(PAGE); }}><option value="">All providers</option><option>AWS</option><option>Azure</option><option>GCP</option></select></label>
            <label>Region<select value={region} onChange={(e) => { setRegion(e.target.value); setShown(PAGE); }}><option value="">All regions</option>{regions.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label>Pricing model<select value={model} onChange={(e) => { setModel(e.target.value); setShown(PAGE); }}><option value="">All models</option>
              {(["on_demand", "reserved", "spot"] as PricingModel[]).map((m) => <option key={m} value={m}>{modelLabel[m]}</option>)}</select></label>
            <label>Instance type<input type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="e.g. m5.large" /></label>
          </div>
          <p className="help" aria-live="polite">Showing {Math.min(shown, rows.length)} of {rows.length} records.</p>
          {rows.length === 0 ? (
            <EmptyState icon={records.length ? <SearchX size={28} /> : <Database size={28} />} title={records.length ? "No records match these filters" : "No pricing records"}
              message={records.length ? "Try removing a filter to see more records." : "The pricing dataset is empty. Seed it from data/pricing.csv."}
              action={records.length ? <button type="button" className="btn btn-secondary" onClick={reset}>Clear filters</button> : undefined} />
          ) : (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Pricing records table">
              <table className="data">
                <thead><tr>{["Provider", "Region", "Instance", "vCPU", "RAM", "Pricing", "$/hour", "Storage $/GB-mo", "Egress $/GB", "Snapshot date"].map((h) =>
                  <th key={h} scope="col" className={["vCPU", "RAM", "$/hour", "Storage $/GB-mo", "Egress $/GB"].includes(h) ? "num" : ""}>{h}</th>)}</tr></thead>
                <tbody key={sig} className={sig !== initialSig.current ? "data-body-anim" : undefined}>
                  {rows.slice(0, shown).map((r) => (
                    <tr key={r.id}><th scope="row">{r.provider}</th><td>{r.region}</td>
                      <td>{r.instance_type}{r.gpu_type && <small className="sub">{gpuLabel(r.gpu_type)} × {r.gpu_count}</small>}</td>
                      <td className="num">{r.vcpu}</td><td className="num">{r.ram_gb} GB</td><td>{modelLabel[r.pricing_model]}</td>
                      <td className="num">{price(r.price_per_hour)}</td><td className="num">{price(r.storage_price_per_gb_month)}</td>
                      <td className="num">{price(r.egress_price_per_gb)}</td><td>{fmtDate(r.price_snapshot_date)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > shown && <div className="row center"><button type="button" className="btn btn-secondary" onClick={() => setShown((s) => s + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more</button></div>}
        </>
      )}
    </div>
  );
}
