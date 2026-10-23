import { Cpu, HardDrive, Network } from "lucide-react";
import { ProviderMark } from "../common/ProviderBadge";
import type { ProviderName } from "../../types";

const PROVIDERS: { key: ProviderName; name: string; sub: string; text: string }[] = [
  { key: "AWS", name: "AWS", sub: "Amazon Web Services", text: "Compare compatible EC2-style compute options and pricing models." },
  { key: "Azure", name: "Microsoft Azure", sub: "Virtual Machines", text: "Compare Azure VM options across supported regions and pricing models." },
  { key: "GCP", name: "Google Cloud", sub: "Compute Engine", text: "Compare Compute Engine options and applicable pricing models." },
];

export function ProviderCards() {
  return (
    <section className="section" aria-labelledby="prov-title">
      <h2 id="prov-title">Three providers, one neutral comparison</h2>
      <ul className="prov-grid">
        {PROVIDERS.map((p) => (
          <li key={p.key} className="prov-card">
            <div className="row gap"><ProviderMark provider={p.key} size={40} /><div><h3>{p.name}</h3><small>{p.sub}</small></div></div>
            <p>{p.text}</p>
            <ul className="prov-tags" aria-label={`${p.name} cost areas compared`}>
              <li><Cpu size={15} aria-hidden="true" />Compute</li>
              <li><HardDrive size={15} aria-hidden="true" />Storage</li>
              <li><Network size={15} aria-hidden="true" />Networking</li>
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
