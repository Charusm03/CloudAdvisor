import { Check } from "lucide-react";
import type { StepId } from "../../services/validation";

export const STEP_LABELS = ["Workload", "Storage & Network", "Usage & Pricing", "Review", "Results"] as const;

export function ProgressStepper({ current, reached, onGo }: { current: StepId; reached: StepId; onGo: (s: StepId) => void }) {
  return (
    <nav aria-label="Analysis progress" className="stepper">
      <ol>
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as StepId;
          const state = n === current ? "current" : n < current ? "done" : "todo";
          const clickable = n < current && n <= reached && n !== 5;
          const inner = (
            <>
              <span className="step-dot" aria-hidden="true">{state === "done" ? <Check size={14} /> : n}</span>
              <span className="step-label">{label}</span>
            </>
          );
          return (
            <li key={label} className={`step ${state}`} aria-current={state === "current" ? "step" : undefined}>
              {clickable ? <button type="button" onClick={() => onGo(n)} aria-label={`Go to step ${n}: ${label}`}>{inner}</button> : <span className="step-static">{inner}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
