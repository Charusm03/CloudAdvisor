import { Calculator, CheckCircle2, Layers, SlidersHorizontal } from "lucide-react";

const STEPS = [
  { n: "01", icon: SlidersHorizontal, title: "Describe", text: "Tell us what your workload needs." },
  { n: "02", icon: Layers, title: "Compare", text: "We match your requirements against compatible cloud resources." },
  { n: "03", icon: Calculator, title: "Calculate", text: "We estimate compute, storage, and network costs." },
  { n: "04", icon: CheckCircle2, title: "Decide", text: "Get ranked options with a transparent explanation." },
] as const;

export function HowItWorks() {
  return (
    <section className="section" aria-labelledby="how-title">
      <h2 id="how-title">How it works</h2>
      <ol className="steps4">
        {STEPS.map(({ n, icon: I, title, text }) => (
          <li key={n}>
            <div className="step-top"><span className="step-n">{n}</span><I size={22} aria-hidden="true" /></div>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
