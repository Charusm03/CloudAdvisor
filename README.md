# CloudWise Advisor: Explainable Multi-Cloud Advisor

## The project in very simple words

Imagine you are about to rent a computer in the cloud for your app. Amazon (AWS), Microsoft (Azure) and Google (GCP) all rent
computers, but each one names things differently, charges differently, and offers different "plans":

* **On-demand**: pay by the hour, stop any time (flexible, costs the most).
* **Reserved**: promise to use it for a year, get a discount (good for things that run all month).
* **Spot**: very cheap spare capacity, but the provider can take it back (good for jobs that can restart).

On top of the computer itself you also pay for **storage** and for **data going out** to the internet (egress). That last one often
surprises people.

**This tool does the comparing for you, before you deploy anything.** You answer a few questions about your workload (how many CPUs,
how much memory, storage, data traffic, how long it runs, whether it can be interrupted). The tool then:

1. picks the **smallest computer that fits** on each cloud,
2. only allows the plans that make sense for you (Spot only if you can be interrupted; Reserved only for steady workloads running 500+ hours a month),
3. adds up **compute + storage + outgoing data** for each option,
4. sorts them **cheapest first** and shows the top 3,
5. **explains why**, using the actual numbers, so you can trust it. There is no hidden "AI score".

Who is it for? Students, start-ups and small teams who have no cloud-cost expert. It does not deploy anything; it only advises.

> The prices in `data/pricing.csv` are **illustrative sample prices**, not live prices. The maths is real, the dollar amounts are test data.

## Run it

```bash
# backend (from this folder)
pip install -r requirements.txt
python -m backend.app                      # http://localhost:5000

# frontend (new terminal)
cd frontend && npm install && npm run dev  # http://localhost:5173
```
Tests: `python -m pytest -q` (148), `cd frontend && npm test` (70), or `sh run_tests.sh` for both.
Browser checks: `python frontend/e2e/journey.py` and `python frontend/e2e/a11y.py` (need Playwright + both servers running).
After changing `data/pricing.csv` run `python -m backend.database.seed --refresh`. If you had an old `advisor.db`, delete it or let the app add the new `gpu_count` column automatically.

## What the menu looks like now

The same five links used to appear **twice**: in the top bar and in the left sidebar. The duplicate top links and the help icon (which only
opened Methodology) were removed. Now there is one menu:

* **Desktop / tablet**: left sidebar (collapsible). The top bar only shows the brand and the pricing snapshot date.
* **Phone**: bottom bar.

Pages: Overview · New Analysis · My Analyses · Pricing Data · Methodology.

## What was fixed in this version (from the implementation audit)

| Problem found | Fix |
|---|---|
| Spot/reserved options appeared even when the workload was not eligible | Hard eligibility: spot only if interruption-tolerant; reserved only if steady-state and ≥ 500 h/month |
| Every compatible instance was listed (166 candidates) | Only the smallest fitting instance per provider, region and pricing model (≤ 9 per region) |
| Ranking used a weighted score, not cost | Ranked by ascending total cost (old weighted mode still available with `RANKING_MODE=weighted`) |
| Runtime cap was 744 h; vCPU could be fractional; no GPU count | 730 h cap, whole-number vCPU, GPU count field |
| Only the first validation error was returned | All field errors returned together |
| Region names differed per provider, so choosing one region dropped the others | Region groups (United States, Europe) compare all three providers; exact regions still work |
| Inbound data was billed although the formula excludes it | Excluded by default (`INCLUDE_INGRESS=1` turns it on) |
| One bad CSV row aborted the whole import | Bad rows are skipped and logged |
| Pricing age not shown | Snapshot age and fresh/stale status in results, pricing page and `GET /api/pricing/meta` |
| Explanation lacked structured parts | Each option now has eligibility reason, biggest cost driver, difference from #1 and tie flag |
| No ML classifier | Random-forest classifier (advisory only, trained on synthetic archetypes, 5-fold CV ≈ 95.6% accuracy). `POST /api/classifier/predict`, metrics in `backend/ml/artifacts/metrics.json`. It never changes which pricing models are eligible |
| No comparison with baselines | `python -m backend.evaluation.baselines` compares the advisor with always-AWS, cheapest-on-demand, round-robin and random |
| W1-W5 report examples not tested end to end | `backend/tests/test_reference_workloads.py` reproduces the report's tables exactly (e.g. W1 Azure reserved $111.80) |
| "Cost vs workload fit" chart became a flat line (all options now share one instance size) | Chart now says so in one line; it still shows cost position |
| Results did not recompute on input change | "Try different assumptions" panel on the results page recomputes automatically |
| Flask `debug=True`, no rate limit | Debug is off by default (`FLASK_DEBUG=1` to enable); simple per-IP rate limit |
| `run_tests.sh` failed on Linux | LF line endings plus `.gitattributes` |

## Still open (needs your decision or real data)

* Real captured prices (the dataset is still illustrative).
* Saved analyses stay in the browser (`localStorage`).
* Not built on purpose: Docker, CI, live provider APIs, hosting. Say so if you want them.
* Tested in Chromium only.

Requirements baseline: `docs/Requirement.md`.
