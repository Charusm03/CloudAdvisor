import { Scale, Tags, Timer } from "lucide-react";

const ITEMS = [
  { icon: Scale, title: "Cloud prices are not directly comparable",
    text: "AWS, Azure, and GCP use different instance families and pricing structures." },
  { icon: Tags, title: "The cheapest VM is not always the cheapest workload",
    text: "Network egress and storage can change the final cost." },
  { icon: Timer, title: "Pricing models have trade-offs",
    text: "On-Demand, Reserved/Committed, and Spot/Preemptible options differ in price and interruption risk." },
] as const;

export function WhyUseAdvisor() {
  return (
    <section className="why" aria-labelledby="why-title">
      <div className="why-inner">
        <h2 id="why-title">Why compare before deployment?</h2>
        <ul className="why-list">
          {ITEMS.map(({ icon: I, title, text }) => (
            <li key={title}><I size={24} aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
