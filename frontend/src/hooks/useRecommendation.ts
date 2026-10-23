import { useCallback, useState } from "react";
import { analyzeWorkload, ApiError } from "../services/api";
import type { RecommendationResponse, WorkloadProfile } from "../types";

export interface RecState {
  loading: boolean; result: RecommendationResponse | null; error: { kind: string; message: string } | null;
}

export function useRecommendation() {
  const [state, setState] = useState<RecState>({ loading: false, result: null, error: null });
  const run = useCallback(async (w: WorkloadProfile) => {
    setState({ loading: true, result: null, error: null });
    try {
      setState({ loading: false, result: await analyzeWorkload(w), error: null });
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError("unknown", "Something went wrong. Please try again.");
      setState({ loading: false, result: null, error: { kind: err.kind, message: err.message } });
    }
  }, []);
  const reset = useCallback(() => setState({ loading: false, result: null, error: null }), []);
  return { ...state, run, reset };
}
