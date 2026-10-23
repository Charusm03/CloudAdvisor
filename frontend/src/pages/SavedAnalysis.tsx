import { Link, useNavigate, useParams } from "react-router-dom";
import { SearchX } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { ResultsDashboard } from "../components/results/ResultsDashboard";
import { useAnalysis, useForm } from "../context/AppContext";
import { fmtDate } from "../lib/format";
import { toForm } from "../services/validation";

export default function SavedAnalysis() {
  const { id } = useParams();
  const { saved, clear } = useAnalysis();
  const { setForm, resetForm } = useForm();
  const nav = useNavigate();
  const a = saved.find((x) => x.id === id);
  if (!a) {
    return (
      <div className="page-pad"><EmptyState icon={<SearchX size={30} />} title="Analysis not found"
        message="This saved analysis doesn't exist in this browser. It may have been deleted."
        action={<Link to="/analyses" className="btn btn-primary">Back to My Analyses</Link>} /></div>
    );
  }
  return (
    <div className="page-pad analysis wide">
      <div className="analysis-head">
        <div><h1 className="page-title">{a.name}</h1><p className="muted">Saved {fmtDate(a.created_at)} · pricing snapshot {fmtDate(a.result.pricing_snapshot_date)}</p></div>
        <Link to="/analyses" className="btn btn-quiet">All analyses</Link>
      </div>
      <ResultsDashboard data={a.result} defaultName={a.name}
        onNew={() => { resetForm(); clear(); nav("/analysis/new"); }}
        onModify={() => { setForm(toForm(a.workload)); clear(); nav("/analysis/new", { state: { step: 4 } }); }} />
    </div>
  );
}
