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
  const [refining, setRefining] = useState(false);
  /** What-if recompute (Requirement FR-UI-02): the previous result stays visible until the new one arrives. */
  const refine = useCallback(async (w: WorkloadProfile) => {
    setRefining(true);
    try {
      const result = await analyzeWorkload(w);
      setState({ loading: false, result, error: null });
    } catch (e) {
      // keep the previous result; surface nothing here (the panel shows its own message via the thrown error)
      if (!(e instanceof ApiError)) return;
      throw e;
    } finally {
      setRefining(false);
    }
  }, []);
  return { ...state, run, reset, refine, refining };
}
