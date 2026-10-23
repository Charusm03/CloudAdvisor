import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Download, FilePlus2, Pencil, Save } from "lucide-react";
import { RecommendationHero } from "./RecommendationHero";
import { WhyRecommended } from "./WhyRecommended";
import { ProviderComparison } from "./ProviderComparison";
import { TopRecommendations } from "./TopRecommendations";
import { CostBreakdown } from "./CostBreakdown";
import { EgressInsight } from "./EgressInsight";
import { SavingsPanel } from "./SavingsPanel";
import { PricingModelComparison } from "./PricingModelComparison";
import { ResourceFit } from "./ResourceFit";
import { CostVsFitChart } from "./CostVsFitChart";
import { AssumptionsPanel } from "./AssumptionsPanel";
import { CandidateTable } from "./CandidateTable";
import { egressInsight } from "../../lib/derive";
import { exportCsv, exportPdf } from "../../lib/export";
import type { RecommendationResponse } from "../../types";

const SECTIONS = [
  ["decision", "Decision"], ["why", "Why"], ["providers", "Providers"], ["options", "Top options"], ["costs", "Cost drivers"],
  ["savings", "Savings"], ["assumptions", "Assumptions"], ["all", "All options"],
] as const;

export interface DashboardProps {
  data: RecommendationResponse; onNew: () => void; onModify: () => void;
  onSave?: (name: string) => void; saved?: boolean; defaultName?: string;
}

export function ResultsDashboard({ data, onNew, onModify, onSave, saved, defaultName }: DashboardProps) {
  const rec = data.best_overall;
  const insight = egressInsight(data);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(defaultName ?? `${data.workload.vcpu} vCPU / ${data.workload.ram_gb} GB workload`);
  const [exporting, setExporting] = useState<null | "pdf" | "csv">(null);
  const [exportErr, setExportErr] = useState(false);
  const fileBase = `cloudwise-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "analysis"}`;
  const doExport = async (kind: "pdf" | "csv") => {
    setExporting(kind); setExportErr(false);
    try { if (kind === "pdf") await exportPdf(data, fileBase); else exportCsv(data, fileBase); } catch { setExportErr(true); }
    setExporting(null);
  };
  return (
    <div className="results">
      <div className="results-bar">
        <nav className="jump" aria-label="Jump to section">{SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
        <div className="row gap wrap">
          <button type="button" className="btn btn-secondary" onClick={onModify}><Pencil size={16} aria-hidden="true" />Modify this analysis</button>
          {onSave && (saved
            ? <span className="saved-ok"><Check size={16} aria-hidden="true" />Saved · <Link to="/analyses">View My Analyses</Link></span>
            : <button type="button" className="btn btn-secondary" onClick={() => setNaming((n) => !n)} aria-expanded={naming}><Save size={16} aria-hidden="true" />Save analysis</button>)}
          <button type="button" className="btn btn-secondary" onClick={() => void doExport("pdf")} disabled={exporting !== null}><Download size={16} aria-hidden="true" />{exporting === "pdf" ? "Preparing PDF…" : "Export PDF"}</button>
          <button type="button" className="btn btn-secondary" onClick={() => void doExport("csv")} disabled={exporting !== null}><Download size={16} aria-hidden="true" />Export CSV</button>
          <button type="button" className="btn btn-primary" onClick={onNew}><FilePlus2 size={16} aria-hidden="true" />New analysis</button>
        </div>
        {naming && !saved && onSave && (
          <div className="save-row" role="group" aria-label="Save analysis">
            <label htmlFor="save-name">Analysis name</label>
            <input id="save-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <button type="button" className="btn btn-primary" onClick={() => { onSave(name); setNaming(false); }}>Save</button>
          </div>
        )}
        {exportErr && <p className="field-error" role="alert">The export couldn't be created. Try again.</p>}
      </div>

      <RecommendationHero rec={rec} />
      <WhyRecommended rec={rec} />
      <ProviderComparison data={data} />
      <TopRecommendations recs={data.recommendations} />
      <CostBreakdown cost={rec} />
      {insight && <EgressInsight insight={insight} />}
      <section className="block" aria-label="Deeper analysis">
        <div className="two-col">
          <SavingsPanel rec={rec} />
          <PricingModelComparison data={data} />
        </div>
        <div className="two-col">
          <ResourceFit workload={data.workload} rec={rec} />
          <CostVsFitChart candidates={data.candidates} best={rec} />
        </div>
      </section>
      <AssumptionsPanel data={data} />
      <CandidateTable data={data} />
    </div>
  );
}
