import { ArrowRight, Cpu, HardDrive, MemoryStick, Network} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "../../context/AppContext";
import { ProviderMark } from "../common/ProviderBadge";

const INPUTS = [
  { icon: Cpu, label: "CPU" }, { icon: MemoryStick, label: "RAM" },
  { icon: HardDrive, label: "Storage" }, { icon: Network, label: "Network" },
] as const;

function Connector() {
  return <div className="flow-link" aria-hidden="true"><span /></div>;
}

/** Workload → Advisor engine → AWS | Azure | GCP → Best fit */
export function HeroFlow() {
  return (
    <figure className="flow" aria-label="How the advisor works: your workload goes into the advisor engine, which compares AWS, Azure and Google Cloud and returns the best fit.">
      <div className="flow-row flow-inputs">
        {INPUTS.map(({ icon: I, label }) => <div key={label} className="flow-chip"><I size={16} aria-hidden="true" />{label}</div>)}
      </div>
      <Connector />
      <div className="flow-engine"><strong>Advisor engine</strong><small>compute + storage + network, per pricing model</small></div>
      <Connector />
      <div className="flow-row flow-providers">
        {(["AWS", "Azure", "GCP"] as const).map((p) => (
          <div key={p} className="flow-prov"><ProviderMark provider={p} size={26} /><span>{p === "GCP" ? "Google Cloud" : p}</span></div>
        ))}
      </div>
      <Connector />
      <div className="flow-best"><strong>Best fit</strong><small>provider · instance · pricing model · cost</small></div>
    </figure>
  );
}

export function Hero() {
  const nav = useNavigate();
  const { loadDemo } = useForm();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title">Choose the right cloud before you deploy.</h1>
        <p className="lede">
          Compare AWS, Azure, and Google Cloud against your actual workload requirements. We calculate compute, storage,
          and network costs, evaluate pricing models, and explain which option gives you the best fit.
        </p>
        <div className="row gap wrap">
          <Link to="/analysis/new" className="btn btn-primary btn-lg">Start a Cost Analysis <ArrowRight size={18} aria-hidden="true" /></Link>
          <button type="button" className="btn btn-ghost-dark btn-lg"
            onClick={() => { loadDemo(); nav("/analysis/new", { state: { autorun: true } }); }}>
            View Example Analysis
          </button>
        </div>
        <p className="hero-note">Prototype: deterministic, cost-based advisor using a dated pricing snapshot.</p>
      </div>
      <HeroFlow />
    </section>
  );
}
