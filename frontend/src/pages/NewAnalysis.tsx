import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, FlaskConical } from "lucide-react";
import { ProgressStepper } from "../components/workload/ProgressStepper";
import { ComputeStep } from "../components/workload/ComputeStep";
import { StorageNetworkStep } from "../components/workload/StorageNetworkStep";
import { UsageStep } from "../components/workload/UsageStep";
import { ReviewStep } from "../components/workload/ReviewStep";
import { LoadingAnalysis } from "../components/common/LoadingAnalysis";
import { ErrorState } from "../components/common/ErrorState";
import { ResultsDashboard } from "../components/results/ResultsDashboard";
import { useAnalysis, useForm } from "../context/AppContext";
import { toWorkload, validateForm, validateStep, type FormErrors, type FormState, type StepId } from "../services/validation";

/** Pace of the analysis progress animation (0 in tests so they stay fast). */
const STAGE_MS = import.meta.env.MODE === "test" ? 0 : 450;

export default function NewAnalysis() {
  const { form, setForm, resetForm, loadDemo } = useForm();
  const { loading, result, error, run, clear, save } = useAnalysis();
  const nav = useNavigate();
  const loc = useLocation();
  const initialStep = ((loc.state as { step?: number } | null)?.step ?? 1) as 1 | 2 | 3 | 4;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep);
  const [reached, setReached] = useState<StepId>(initialStep);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState<boolean>(() => !!result || loading);
  const [stage, setStage] = useState<number>(() => (result ? 5 : 0));
  const [saved, setSaved] = useState(false);
  const autoRan = useRef(false);

  const set = (p: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...p }));
    setErrors((e) => { const n = { ...e }; for (const k of Object.keys(p)) delete n[k as keyof FormState]; return n; });
  };

  const submit = (f: FormState = form) => {
    const all = validateForm(f);
    if (Object.keys(all).length) {
      setErrors(all);
      const bad = ([1, 2, 3] as const).find((s) => Object.keys(validateStep(f, s)).length);
      if (bad) { setStep(bad); setSubmitted(false); }
      return;
    }
    setSubmitted(true); setStage(0); setSaved(false);
    void run(toWorkload(f));
  };

  // Animated progress: advance one stage at a time; hold at stage 3 until the response has arrived.
  useEffect(() => {
    if (!submitted || stage >= 5) return;
    const cap = loading ? 3 : 5;
    if (stage >= cap) return;
    const t = setTimeout(() => setStage((s) => Math.min(s + 1, cap)), STAGE_MS);
    return () => clearTimeout(t);
  }, [submitted, stage, loading]);

  // "View Example Analysis" from the overview
  useEffect(() => {
    if ((loc.state as { autorun?: boolean } | null)?.autorun && !autoRan.current) {
      autoRan.current = true;
      nav(loc.pathname, { replace: true, state: null });
      submit(form);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { (document.querySelector(".wizard h2") as HTMLElement | null)?.focus(); }, [step]);

  const showLoading = submitted && !error && stage < 5;
  const showResults = submitted && !error && !showLoading && !!result;
  const current: StepId = submitted ? 5 : step;

  const go = (s: StepId) => { if (s <= 4) { setSubmitted(false); clear(); setStep(s as 1 | 2 | 3 | 4); } };
  const next = () => {
    if (step === 4) return;
    const errs = validateStep(form, step as 1 | 2 | 3);
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus());
      return;
    }
    const n = (step + 1) as 2 | 3 | 4;
    setStep(n); setReached((r) => (n > r ? n : r) as StepId);
  };
  const newAnalysis = () => { resetForm(); clear(); setSubmitted(false); setStep(1); setReached(1); setErrors({}); setSaved(false); };
  const modify = () => { clear(); setSubmitted(false); setStep(4); setReached(4); };

  return (
    <div className={`page-pad analysis ${showResults ? "wide" : ""}`}>
      <div className="analysis-head">
        <h1 className="page-title">{showResults ? "Your cloud decision" : "New analysis"}</h1>
        {!submitted && step < 4 && (
          <button type="button" className="btn btn-quiet" onClick={() => { loadDemo(); setErrors({}); }}>
            <FlaskConical size={16} aria-hidden="true" />Try an example
          </button>
        )}
      </div>
      <ProgressStepper current={current} reached={Math.max(reached, step) as StepId} onGo={go} />

      {showLoading && <LoadingAnalysis stage={stage} />}

      {submitted && error && (
        error.kind === "no_compatible_candidates" ? (
          <ErrorState title="No compatible resources found"
            message="We couldn't find a pricing record that satisfies your current CPU, memory, GPU, or region requirements."
            actions={<>
              <button type="button" className="btn btn-primary" onClick={() => go(1)}>Edit workload</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setForm((f) => ({ ...f, preferred_region: "any" })); go(3); }}>Change region</button>
            </>} />
        ) : error.kind === "network" ? (
          <ErrorState title="The advisor service isn't reachable"
            message="Check that the backend is running, then try again. Your workload details are still saved."
            actions={<button type="button" className="btn btn-primary" onClick={() => submit()}>Try again</button>} />
        ) : (
          <ErrorState title="We couldn't complete the analysis"
            message="Some of your workload details were not accepted, or the service had a problem. Review your workload and try again."
            actions={<><button type="button" className="btn btn-primary" onClick={() => go(4)}>Review workload</button>
              <button type="button" className="btn btn-secondary" onClick={() => submit()}>Try again</button></>} />
        )
      )}

      {showResults && result && (
        <ResultsDashboard data={result} onNew={newAnalysis} onModify={modify} saved={saved}
          onSave={(name) => { if (save(name)) setSaved(true); }} />
      )}

      {!submitted && (
        <div className="wizard" key={step}>
          {step === 1 && <ComputeStep form={form} errors={errors} set={set} />}
          {step === 2 && <StorageNetworkStep form={form} errors={errors} set={set} />}
          {step === 3 && <UsageStep form={form} errors={errors} set={set} />}
          {step === 4 && <ReviewStep form={form} go={(s) => go(s)} onSubmit={() => submit()} busy={loading} />}
          <div className="wizard-nav">
            <button type="button" className="btn btn-secondary" onClick={() => setStep((s) => (Math.max(1, s - 1)) as 1 | 2 | 3 | 4)} disabled={step === 1}>
              <ArrowLeft size={16} aria-hidden="true" />Back
            </button>
            {step < 4 && <button type="button" className="btn btn-primary" onClick={next}>Continue<ArrowRight size={16} aria-hidden="true" /></button>}
          </div>
        </div>
      )}
    </div>
  );
}
