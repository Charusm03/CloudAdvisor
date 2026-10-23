import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchPricing } from "../services/api";
import { useRecommendation } from "../hooks/useRecommendation";
import { deleteAnalysis, loadAnalyses, saveAnalysis } from "../lib/storage";
import { DEMO_FORM, EMPTY_FORM, type FormState } from "../services/validation";
import type { PricingRecord, ProviderName, RecommendationResponse, SavedAnalysis, WorkloadProfile } from "../types";

/* ---- Pricing data (shared, read-only) ---- */
interface PricingCtx {
  records: PricingRecord[]; loading: boolean; error: string | null; snapshotDate: string | null;
  regionsByProvider: Record<ProviderName, string[]>; gpuTypes: string[]; retry: () => void;
}
const PricingContext = createContext<PricingCtx | null>(null);

export function PricingProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<PricingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchPricing()
      .then((r) => { if (live) { setRecords(r); setError(null); } })
      .catch((e: Error) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tick]);
  const value = useMemo<PricingCtx>(() => {
    const regionsByProvider: Record<ProviderName, string[]> = { AWS: [], Azure: [], GCP: [] };
    for (const r of records) if (!regionsByProvider[r.provider]?.includes(r.region)) regionsByProvider[r.provider]?.push(r.region);
    for (const p of Object.keys(regionsByProvider) as ProviderName[]) regionsByProvider[p].sort();
    const gpuTypes = [...new Set(records.map((r) => r.gpu_type).filter((g): g is string => !!g))].sort();
    const snapshotDate = records.length ? [...records.map((r) => r.price_snapshot_date)].sort().slice(-1)[0] : null;
    return { records, loading, error, snapshotDate, regionsByProvider, gpuTypes, retry: () => setTick((t) => t + 1) };
  }, [records, loading, error]);
  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}
export function usePricing() {
  const c = useContext(PricingContext);
  if (!c) throw new Error("usePricing must be used inside PricingProvider");
  return c;
}

/* ---- Form state: kept separate from result state (spec §57) ---- */
interface FormCtx {
  form: FormState; setForm: (f: FormState | ((p: FormState) => FormState)) => void; resetForm: () => void; loadDemo: () => void;
}
const FormContext = createContext<FormCtx | null>(null);
export function FormProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const value = useMemo<FormCtx>(() => ({
    form, setForm, resetForm: () => setForm(EMPTY_FORM), loadDemo: () => setForm(DEMO_FORM),
  }), [form]);
  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
}
export function useForm() {
  const c = useContext(FormContext);
  if (!c) throw new Error("useForm must be used inside FormProvider");
  return c;
}

/* ---- Result state + saved analyses ---- */
interface AnalysisCtx {
  loading: boolean; result: RecommendationResponse | null; error: { kind: string; message: string } | null;
  run: (w: WorkloadProfile) => Promise<void>; clear: () => void;
  saved: SavedAnalysis[]; save: (name: string) => SavedAnalysis | null; remove: (id: string) => void;
}
const AnalysisContext = createContext<AnalysisCtx | null>(null);
export function AnalysisProvider({ children }: { children: ReactNode }) {
  const rec = useRecommendation();
  const [saved, setSaved] = useState<SavedAnalysis[]>(() => loadAnalyses());
  const save = useCallback((name: string) => {
    if (!rec.result) return null;
    const s = saveAnalysis(name, rec.result.workload, rec.result);
    setSaved(loadAnalyses());
    return s;
  }, [rec.result]);
  const remove = useCallback((id: string) => { deleteAnalysis(id); setSaved(loadAnalyses()); }, []);
  const value = useMemo<AnalysisCtx>(() => ({
    loading: rec.loading, result: rec.result, error: rec.error, run: rec.run, clear: rec.reset, saved, save, remove,
  }), [rec.loading, rec.result, rec.error, rec.run, rec.reset, saved, save, remove]);
  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
export function useAnalysis() {
  const c = useContext(AnalysisContext);
  if (!c) throw new Error("useAnalysis must be used inside AnalysisProvider");
  return c;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return <PricingProvider><FormProvider><AnalysisProvider>{children}</AnalysisProvider></FormProvider></PricingProvider>;
}
