import { Cpu, MemoryStick } from "lucide-react";
import type { FormState } from "../../services/validation";

const bar = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

export function ResourceSummary({ form }: { form: FormState }) {
  const cpu = Number(form.vcpu), ram = Number(form.ram_gb);
  const has = (n: number) => Number.isFinite(n) && n > 0;
  return (
    <aside className="resource-summary" aria-label="Requested resources">
      <h3>Requested resources</h3>
      <div className="res-row">
        <span className="res-name"><Cpu size={16} aria-hidden="true" />CPU</span>
        <div className="res-bar" aria-hidden="true"><span style={{ width: has(cpu) ? bar(cpu, 32) : "0%" }} /></div>
        <strong>{has(cpu) ? `${cpu} vCPU` : "—"}</strong>
      </div>
      <div className="res-row">
        <span className="res-name"><MemoryStick size={16} aria-hidden="true" />Memory</span>
        <div className="res-bar" aria-hidden="true"><span style={{ width: has(ram) ? bar(ram, 128) : "0%" }} /></div>
        <strong>{has(ram) ? `${ram} GB` : "—"}</strong>
      </div>
      <p className="help">Bars are drawn on a 32 vCPU / 128 GB scale for orientation only.</p>
    </aside>
  );
}
