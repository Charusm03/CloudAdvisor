import { useId, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

export const TERMS = {
  vcpu: { label: "vCPU", text: "A virtual CPU core. Roughly one hardware thread allocated to your workload." },
  ram: { label: "RAM", text: "Memory available to your workload while it runs, measured in GB." },
  egress: { label: "Egress", text: "Data leaving a cloud provider. It can contribute significantly to total workload cost." },
  ingress: { label: "Ingress", text: "Data coming into a cloud provider. Most providers charge little or nothing for it." },
  spot: { label: "Spot", text: "Spare capacity sold at a discount. The provider can reclaim it, so the workload may be interrupted." },
  preemptible: { label: "Preemptible", text: "Google Cloud's name for spot-style capacity that can be stopped at any time." },
  reserved: { label: "Reserved", text: "A 1-year commitment in exchange for a lower hourly price. You pay for the capacity all month." },
  fit: { label: "Workload fit", text: "How closely the instance size matches your requested vCPU and RAM. 100% means no unused capacity." },
  snapshot: { label: "Pricing snapshot", text: "The date the price records were captured. Prices change, so results are estimates, not live quotes." },
  ondemand: { label: "On-Demand", text: "Pay by the hour with no commitment and no interruption." },
} as const;
export type TermKey = keyof typeof TERMS;

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="tip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="tip-btn" aria-label={`What is ${label}?`} aria-describedby={open ? id : undefined}
        aria-expanded={open} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
        <CircleHelp size={14} aria-hidden="true" />
      </button>
      {open && <span role="tooltip" id={id} className="tip-body">{children}</span>}
    </span>
  );
}

/** Term label followed by an info tooltip. */
export function Term({ k, children, bare }: { k: TermKey; children?: ReactNode; bare?: boolean }) {
  const t = TERMS[k];
  if (bare) return <Tooltip label={t.label}><strong>{t.label}</strong> {t.text}</Tooltip>;
  return <span className="term">{children ?? t.label}<Tooltip label={t.label}><strong>{t.label}</strong> {t.text}</Tooltip></span>;
}
