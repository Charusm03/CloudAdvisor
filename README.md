# Explainable Multi-Cloud Advisor for Choosing Cloud Providers and Pricing Models Before Deployment

An explainable **pre-deployment multi-cloud cost advisor**. It is deterministic: no machine learning, no live
pricing, no deployment. Every number can be reproduced from *workload input + pricing data + recommendation rules*.

## 1–3. Problem, motivation, objectives
Teams usually pick a cloud provider and pricing model by habit. FinOps tools audit spend *after* resources run, and
cloud-broker research returns ranked results without auditable reasoning. This system takes a structured workload
profile **before** deployment and:
1. validates it; 2. finds technically compatible instances across AWS, Azure and GCP; 3. itemises monthly cost
(compute, storage, egress, ingress) for on-demand, spot and reserved pricing; 4. ranks candidates; 5. returns the
top 3 with plain-language, number-backed explanations; 6. shows savings against selectable baselines; 7. states
assumptions and the pricing-snapshot date.

## 4. Architecture
```
React (Vite, TS) --HTTP/JSON--> Flask REST API
   routes -> workload_service / pricing_service -> candidate_service (matching + fit)
          -> cost_engine -> recommendation_engine (ranking, baselines) -> explanation_service
```
Business logic is in `backend/services` (pure functions over dataclasses, no Flask/ORM imports), so it is unit-testable.
Extension points: `PricingProvider` (`StaticPricingProvider` today; live AWS/Azure/GCP later) and
`WorkloadClassifier` (`ManualWorkloadClassifier` echoes the dropdown; an ML classifier can replace it without touching the cost engine).

## 5. Stack
React + Vite + TypeScript · Flask + Flask-CORS · SQLAlchemy 2 + SQLite · pytest · Vitest + React Testing Library.

## 6. Database schema
`workload_profiles(id, vcpu, ram_gb, storage_gb, storage_type, monthly_data_transfer_in_gb, monthly_data_transfer_out_gb, usage_pattern, gpu_required, gpu_type, expected_runtime_hours_per_month, interruption_tolerant, preferred_region, created_at)`

`pricing_records(id, provider, region, instance_type, vcpu, ram_gb, gpu_type, gpu_count, storage_type_supported, pricing_model, price_per_hour, storage_price_per_gb_month, egress_price_per_gb, ingress_price_per_gb, interruption_risk, commitment_months, source, price_snapshot_date)`

`pricing_records` is seeded from `data/pricing.csv` on first start (`python -m backend.database.seed --reset` to reload).

## 7. API
| Method & path | Purpose |
|---|---|
| `POST /api/workloads` | validate + store → 201 |
| `GET /api/workloads`, `GET /api/workloads/<id>` | list / fetch (404 `not_found`) |
| `GET /api/pricing?provider&region&pricing_model&min_vcpu&min_ram` | query price records |
| `POST /api/recommendations` `{"workload_id": 1}` | recommend for a saved workload |
| `POST /api/recommendations/preview` | recommend for a workload sent directly (not saved) |

Errors are structured: `400 {"error":"validation_error","message":...,"field":...}`,
`422 {"error":"no_compatible_candidates","message":...}`, `404 not_found`, `413 payload_too_large`.
Responses contain `recommendations` (top 3), `best_overall`, `cheapest_valid`, `provider_comparison`, `candidates` (all, ranked),
`baselines`, `pricing_snapshot_date`, `assumptions`, `workload`.

## 8. Cost formulas (`backend/services/cost_engine.py`, Decimal, rounded only for display)
```
compute  on_demand  = price_per_hour * runtime
         spot       = price_per_hour * runtime * (1 + 0.10)        # re-run overhead, configurable
         reserved   = price_per_hour * max(runtime, 730)           # committed capacity is billed all month
storage  = storage_gb * storage_price_per_gb_month
egress   = monthly_out_gb * egress_price_per_gb
ingress  = monthly_in_gb  * ingress_price_per_gb
total    = compute + storage + egress + ingress
savings  = baseline - recommended ;  savings% = savings / baseline * 100
```
Two deliberate refinements of the plain `price × runtime` formula (both configurable in `CostConfig`, both match the project report):
reserved capacity is billed for the full month, and spot carries a 10% re-run overhead. Set `reserved_billed_full_month=False`
and `spot_rerun_overhead=0` to get the plain formula.

## 9. Recommendation algorithm (`recommendation_engine.py`, weights in `backend/config.py`)
1. **Compatibility (hard filter):** vCPU ≥ required, RAM ≥ required, storage type supported, region match (or `any`),
   exact GPU type with ≥1 GPU when required. GPU instances are excluded when no GPU is requested.
2. **Score** = `0.70·cost_score + 0.10·fit_score + 0.20·suitability − interruption_penalty − commitment_penalty`
   * `cost_score = cheapest_total / candidate_total`; `fit_score = (req_vcpu/vcpu + req_ram/ram)/2`
   * `suitability` per usage pattern × pricing model (table in config); spot scores 0 when the workload is not interruption tolerant
   * `interruption_penalty` (spot only): low 0, medium 0.03, high 0.08; `commitment_penalty` 0.15 for reserved + bursty
3. **Interruption constraint:** spot candidates for non-tolerant workloads sort *after* every other candidate: shown as
   alternatives (with a warning), never primary.
4. Sort key `(spot_not_primary, -score, total, provider, region, instance, model)` → deterministic.
The UI shows the cheapest valid option, the best overall option and the top 3 separately; they need not be identical.

## 10. Explainability
No SHAP/LIME: explanations are assembled from the cost breakdown, the fit values and the business rules. They state the
requirement match, itemised cost, fit, pricing-model suitability, interruption risk, the difference to the next-best option
(or "effectively tied" within 2%), egress when it is ≥25% of the total, and a trade-off sentence when a candidate with lower
compute cost loses on egress/storage.

## 11. Pricing assumptions
`data/pricing.csv` holds ~266 records (3 providers × 2 regions × ~15 instance types × on-demand/spot/reserved-1yr).
**The values are illustrative, not captured from provider pages.** Before presenting results as real, replace them with
captured prices, set `source` to the page URL, and update `price_snapshot_date`. The UI always shows the snapshot date and
states that prices may change. Spot/reserved are not offered for some instances (e.g. Azure B-series spot); such candidates are simply absent.

## 12. Install & run
```
python -m venv .venv && . .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m backend.app                                # http://localhost:5000  (run from the repo root)
cd frontend && npm install && npm run dev            # http://localhost:5173
```
Config via environment: `DATABASE_URL`, `PRICING_CSV`, `CORS_ORIGINS`; frontend: `VITE_API_URL`.

## 13. Tests
`./run_tests.sh` (or `pytest` and `cd frontend && npm test`). Backend: workload validation (TC-W), candidate matching (TC-C),
cost engine (TC-K, incl. parity with the report's worked examples), pricing models (TC-P), recommendations (TC-R), baselines,
explanations, scenarios A–H and the demo workload through the API. Frontend: 65 Vitest tests (landing, wizard, results, empty/error states, pricing/methodology pages, layout contract).

## 14. Sample
Workload: 4 vCPU, 16 GB, 200 GB SSD, 100 GB in / 1000 GB out, steady-state, 720 h, not interruption tolerant, region any.
Use the **Load demo workload** button, or `curl -X POST localhost:5000/api/recommendations/preview -H 'Content-Type: application/json' -d @demo.json`.

## 15. Limitations
Illustrative single-snapshot prices; one flat storage rate per record (SSD = HDD); flat egress, no free tier or volume
tiers; instances with equal vCPU/RAM assumed to perform equally; no taxes, licences, load balancers, NAT, DNS, snapshots,
object storage, managed services, upfront payments, sustained-use discounts, spot price fluctuation or capacity guarantees.
Top-3 can contain the same instance in different regions. Burstable instances (B-series, t3, e2-medium) are matched on vCPU/RAM only.

## 16. Future work
Live pricing providers (`AWSPricingProvider`, …), tiered egress, multi-year commitments, spot volatility from history,
performance-normalised cost, an ML `WorkloadClassifier` trained on public traces, evaluation against baselines on public traces, a user study of explanation trust.


## 11. Frontend (CloudWise Advisor)
React + Vite + TypeScript, React Router, Lucide icons. No backend contract changed: it uses `POST /api/recommendations/preview`
and `GET /api/pricing` (regions, GPU types, snapshot date and the pricing explorer all come from the data).

```
src/pages        Overview, NewAnalysis (wizard + progress + results), MyAnalyses, SavedAnalysis, PricingData, Methodology
src/components   AppShell/Header/Sidebar · landing/ · workload/ (stepper + 4 steps) · results/ · common/
src/context      PricingProvider, FormProvider (form state), AnalysisProvider (result state + saved analyses)
src/lib          derive.ts (insights computed only from API numbers), export.ts (CSV/PDF), storage.ts, format.ts
```
* **Results order:** decision → why → provider comparison → top 3 → cost drivers (+ egress insight) → savings / pricing models / fit / chart → assumptions → all candidates.
* **Egress insight** appears only when another provider has cheaper compute but a higher total because of egress (`lib/derive.ts`).
* **Workload fit** is the backend's `resource_fit_score` (instance size vs request). It is not a prediction and not AI.
* **Saved analyses** live in the browser (`localStorage`, key `cloudwise.analyses.v1`): workload, full result, snapshot date and timestamp. No backend change.
* **Export:** CSV (all candidates) and PDF (summary, top 3, breakdown, provider comparison, assumptions; jsPDF is loaded on demand).
* **Provider marks** are neutral monograms, not official logos (trademark-safe; swap in licensed assets if you have them).
* **Browser check:** with both servers running, `python frontend/e2e/journey.py` (needs `pip install playwright`) walks the whole journey, exports CSV/PDF, and measures horizontal overflow at 1440/1024/768/390.
* **Accessibility audit:** `python frontend/e2e/a11y.py` runs axe-core (WCAG 2.0/2.1 A and AA plus best practices) in Chromium on every screen; the current build reports 0 violations.
