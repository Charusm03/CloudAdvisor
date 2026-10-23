import { Link } from "react-router-dom";
import { Hero } from "../components/landing/Hero";
import { HowItWorks } from "../components/landing/HowItWorks";
import { WhyUseAdvisor } from "../components/landing/WhyUseAdvisor";
import { ProviderCards } from "../components/landing/ProviderCards";

export default function Overview() {
  return (
    <div className="page-landing">
      <Hero />
      <div className="page-pad">
        <HowItWorks />
      </div>
      <WhyUseAdvisor />
      <div className="page-pad">
        <ProviderCards />
        <section className="final-cta">
          <h2>Know which cloud fits before you commit.</h2>
          <Link to="/analysis/new" className="btn btn-primary btn-lg">Start a Cost Analysis</Link>
        </section>
      </div>
    </div>
  );
}
