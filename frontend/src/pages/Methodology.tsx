const Formula = ({ children }: { children: string }) => <pre className="formula" tabIndex={0}>{children}</pre>;

export default function Methodology() {
  return (
    <div className="page-pad prose">
      <h1 className="page-title">Methodology</h1>
      <p className="step-sub">Every number in a result can be reproduced from your workload, the pricing snapshot and the rules below. The recommendation itself is deterministic: costs and ranking use no machine learning and no live prices. An optional, advisory workload classifier is described in section 6.</p>

      <section aria-labelledby="m1"><h2 id="m1">1. Workload requirements</h2>
        <p>You describe vCPU, RAM, storage (GB and SSD/HDD), monthly inbound and outbound data, usage pattern, expected runtime (at most 730 hours/month), GPU type and count, interruption tolerance and region. vCPU must be a whole number.</p></section>

      <section aria-labelledby="m2"><h2 id="m2">2. Candidate matching</h2>
        <p>A pricing record is a candidate only if it passes every hard filter:</p>
        <ul><li>vCPU and RAM are at least what you requested.</li><li>The storage type you chose is supported.</li>
          <li>The region matches: “Any supported region”, a region group such as United States or Europe (which maps to one region per provider), or one specific region.</li>
          <li>If a GPU is required, the GPU type matches exactly with at least your requested number of GPUs. GPU instances are excluded when no GPU is requested.</li></ul>
        <p>Pricing-model eligibility is then applied <strong>before</strong> any cost is computed:</p>
        <ul><li><strong>On-demand</strong> is always eligible.</li>
          <li><strong>Spot</strong> is offered only if the workload tolerates interruption.</li>
          <li><strong>Reserved</strong> is offered only for steady-state workloads running at least 500 hours/month (the break-even is about 482 hours for a 34% discount).</li></ul>
        <p>Finally, for each provider, region and pricing model only the <strong>smallest fitting instance</strong> is kept (ties go to the cheaper one), so you never pay for capacity you did not ask for and one region yields at most nine candidates.</p></section>

      <section aria-labelledby="m3"><h2 id="m3">3. Cost calculation</h2>
        <Formula>{`Compute (On-Demand)  = hourly price × monthly runtime
Compute (Spot)       = hourly price × monthly runtime × (1 + 10% re-run overhead)
Compute (Reserved)   = hourly price × max(monthly runtime, 730)
Storage cost         = storage GB × storage price per GB-month
Egress cost          = outbound GB × egress price per GB
Total                = compute + storage + egress
(Inbound data is normally free; set INCLUDE_INGRESS=1 on the backend to bill it.)
Savings              = baseline total − recommended total
Savings %            = savings ÷ baseline total × 100`}</Formula>
        <p>Reserved capacity is billed for the whole month, and spot adds a 10% overhead for re-running interrupted work. Both values are configurable in the backend.</p></section>

      <section aria-labelledby="m4"><h2 id="m4">4. Pricing-model suitability</h2>
        <p>Each usage pattern gives each pricing model a suitability value between 0 and 1. Spot scores 0 when the workload is not interruption tolerant.</p>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Suitability table"><table className="data compact">
          <thead><tr><th scope="col">Usage pattern</th><th scope="col" className="num">On-Demand</th><th scope="col" className="num">Reserved</th><th scope="col" className="num">Spot</th></tr></thead>
          <tbody>
            <tr><th scope="row">Steady-state</th><td className="num">0.7</td><td className="num">1.0</td><td className="num">0.3</td></tr>
            <tr><th scope="row">Bursty</th><td className="num">1.0</td><td className="num">0.1</td><td className="num">0.5</td></tr>
            <tr><th scope="row">Batch / scheduled</th><td className="num">0.7</td><td className="num">0.3</td><td className="num">1.0</td></tr>
            <tr><th scope="row">GPU-intensive</th><td className="num">1.0</td><td className="num">0.6</td><td className="num">0.6</td></tr>
          </tbody></table></div>
        <p className="help">Default values from <code>backend/config.py</code>. If that file changes, these numbers change with it.</p></section>

      <section aria-labelledby="m5"><h2 id="m5">5. Recommendation ranking</h2>
        <Formula>{`rank = ascending total monthly cost
       (ties: provider, region, instance, pricing model)

workload fit = (requested vCPU ÷ vCPU + requested RAM ÷ RAM) ÷ 2   (shown for information)`}</Formula>
        <p>Candidates are ordered by total monthly cost, lowest first, and the top three are shown. Because ineligible pricing models are never generated, a spot or reserved option can only appear when your workload qualifies for it. Ties are broken by provider, region and instance name, so results are repeatable. The workload-fit and suitability values are reported alongside each option but do not change the order. (The backend can optionally use a weighted cost/fit/suitability score with RANKING_MODE=weighted.)</p></section>

      <section aria-labelledby="m6"><h2 id="m6">6. Explainability</h2>
        <p>Explanations are assembled from the cost breakdown, the fit values and the rules above. No sentence is generated by a model. They state the requirement match, the itemised cost, the fit, the pricing-model suitability, the interruption risk, why the pricing model was eligible, and the largest cost driver. They also state the gap to the next option (“effectively tied” within 2%), egress when it is at least 25% of the total, and a trade-off sentence when another option has cheaper compute but a higher total.</p></section>

      <section aria-labelledby="m6b"><h2 id="m6b">6b. Workload classifier (advisory)</h2>
        <p>A random-forest model, trained on synthetic archetype profiles and cross-validated (stratified 5-fold, accuracy and macro-F1), predicts which usage pattern your profile resembles and shows its strategy prior. It is advisory only: your selected pattern is always what the engine uses, and the prediction can never make a pricing model eligible or ineligible.</p></section>

      <section aria-labelledby="m7"><h2 id="m7">7. Limitations</h2>
        <ul><li>Prices come from a dated snapshot and are illustrative. They are not live quotes.</li>
          <li>Network pricing is a flat per-GB rate with no free tiers or volume discounts.</li>
          <li>SSD and HDD are priced alike in the dataset.</li>
          <li>Spot price changes and capacity availability are not modelled.</li>
          <li>Taxes, licences, load balancers, NAT, DNS, snapshots, object storage, managed services and upfront payments are excluded.</li>
          <li>Workload fit measures instance size against your request only. It does not predict performance.</li></ul></section>
    </div>
  );
}
