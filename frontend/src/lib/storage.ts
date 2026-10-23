import type { RecommendationResponse, SavedAnalysis, WorkloadProfile } from "../types";

const KEY = "cloudwise.analyses.v1";

export function loadAnalyses(): SavedAnalysis[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedAnalysis[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function write(list: SavedAnalysis[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}

export function saveAnalysis(name: string, workload: WorkloadProfile, result: RecommendationResponse): SavedAnalysis {
  const rec: SavedAnalysis = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || "Untitled analysis", created_at: new Date().toISOString(), workload, result,
  };
  write([rec, ...loadAnalyses()]);
  return rec;
}

export function deleteAnalysis(id: string) { write(loadAnalyses().filter((a) => a.id !== id)); }
