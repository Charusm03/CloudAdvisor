import { Check, Circle, Loader2 } from "lucide-react";

export const ANALYSIS_STAGES = [
  "Validating requirements", "Matching compatible instances", "Calculating provider costs",
  "Comparing pricing models", "Generating recommendation",
];

/** `stage` = index of the step currently running. Steps before it are done. */
export function LoadingAnalysis({ stage }: { stage: number }) {
  return (
    <section className="analysis-progress" aria-live="polite" aria-busy="true">
      <h2>Analyzing workload…</h2>
      <ol>
        {ANALYSIS_STAGES.map((label, i) => {
          const state = i < stage ? "done" : i === stage ? "active" : "todo";
          return (
            <li key={label} className={`stage ${state}`}>
              {state === "done" && <Check size={18} aria-hidden="true" />}
              {state === "active" && <Loader2 size={18} className="spin" aria-hidden="true" />}
              {state === "todo" && <Circle size={18} aria-hidden="true" />}
              <span>{label}</span>
              <span className="sr-only">{state === "done" ? " (done)" : state === "active" ? " (in progress)" : " (waiting)"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
