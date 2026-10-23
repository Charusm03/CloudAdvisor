import { Gauge } from "lucide-react";
import { utilizationMessage } from "../../lib/derive";
import { num } from "../../lib/format";
import type { Candidate, WorkloadProfile } from "../../types";

export function ResourceFit({ workload, rec }: { workload: WorkloadProfile; rec: Candidate }) {
  const cpu = Math.max(0, rec.vcpu - workload.vcpu), ram = Math.max(0, rec.ram_gb - workload.ram_gb);
  return (
    <section className="block-sm" aria-labelledby="fit-h">
      <h3 id="fit-h"><Gauge size={18} aria-hidden="true" /> Resource utilization fit</h3>
      <dl className="kv wide">
        <div><dt>Requested</dt><dd>{num(workload.vcpu)} vCPU / {num(workload.ram_gb)} GB</dd></div>
        <div><dt>Selected</dt><dd>{num(rec.vcpu)} vCPU / {num(rec.ram_gb)} GB</dd></div>
        <div><dt>CPU surplus</dt><dd>{num(cpu)}</dd></div>
        <div><dt>RAM surplus</dt><dd>{num(ram)} GB</dd></div>
      </dl>
      <p>{utilizationMessage({ ...rec, cpu_surplus: cpu, ram_surplus: ram })}</p>
    </section>
  );
}
