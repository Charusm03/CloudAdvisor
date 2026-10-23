import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi, renderApp } from "./utils";
import { response, responseNoEgress } from "./fixtures";
import type { RecommendationResponse } from "../types";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

async function openResults(data: RecommendationResponse = response) {
  mockApi({ body: data });
  await renderApp("/");
  await userEvent.click(screen.getByRole("button", { name: "View Example Analysis" }));
  await screen.findByRole("heading", { name: "Why we recommend this" });
}
const primaryNav = () => within(screen.getByRole("navigation", { name: "Primary" }));

describe("results dashboard", () => {
  it("leads with the recommendation: provider, instance, pricing model, region, cost, savings, fit", async () => {
    await openResults();
    const hero = document.getElementById("decision")!;
    const h = within(hero);
    expect(h.getByText("Recommended")).toBeInTheDocument();
    expect(h.getByText("Azure")).toBeInTheDocument(); expect(h.getByText("D4s_v3")).toBeInTheDocument();
    expect(h.getByText("Reserved/Committed")).toBeInTheDocument(); expect(h.getByText("eastus")).toBeInTheDocument();
    expect(h.getByText("$111.80")).toBeInTheDocument();
    expect(hero).toHaveTextContent("Save $53.26 / month (32.3%)");
    expect(h.getByRole("img", { name: "Workload fit 100 percent" })).toBeInTheDocument();
    expect(h.getByText("Workload fit")).toBeInTheDocument();
    expect(h.getByRole("link", { name: /View why this was selected/ })).toHaveAttribute("href", "#why");
  });

  it("follows the mandatory information hierarchy", async () => {
    await openResults();
    const order = ["decision", "why", "providers", "options", "costs", "egress", "savings", "assumptions", "all"].map((id) => document.getElementById(id)!);
    order.forEach((el, i) => { expect(el, `section ${i}`).toBeTruthy(); if (i) expect(order[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); });
  });

  it("explains why using the backend's reasons", async () => {
    await openResults();
    const why = within(document.getElementById("why")!);
    expect(why.getByText(/Satisfies the requested 4 vCPU \/ 16 GB RAM/)).toBeInTheDocument();
    expect(why.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
  });

  it("shows the cost breakdown with a table and a stacked bar", async () => {
    await openResults();
    const sec = document.getElementById("costs")!;
    const s = within(sec);
    expect(s.getByRole("heading", { name: "What drives the cost?" })).toBeInTheDocument();
    expect(s.getByRole("img", { name: /Compute \$86\.90, Storage \$7\.50, Outbound data \$17\.40, Inbound data \$0\.00/ })).toBeInTheDocument();
    const rows = within(s.getByRole("table")).getAllByRole("row");
    expect(rows.map((r) => r.textContent).join("|")).toMatch(/Compute.*\$86\.90.*Storage.*\$7\.50.*Outbound.*\$17\.40.*Inbound.*\$0\.00.*Total.*\$111\.80/);
    expect(sec).toHaveTextContent("Compute is the largest part of the bill (78% of the monthly total)");
  });

  it("compares the three providers with comparable cards and marks the recommended one", async () => {
    await openResults();
    const items = within(document.getElementById("providers")!).getAllByRole("listitem").filter((li) => li.classList.contains("pc"));
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Amazon Web Services"); expect(items[0]).toHaveTextContent("$205.00");
    expect(items[1]).toHaveTextContent("Microsoft Azure"); expect(items[1]).toHaveTextContent("$111.80"); expect(items[1]).toHaveTextContent("Recommended");
    expect(items[2]).toHaveTextContent("Google Cloud"); expect(items[2]).toHaveTextContent("n2-standard-4");
    expect(items[1]).toHaveTextContent("32.3% vs cheapest on-demand");
    expect(items[0]).toHaveTextContent("None vs cheapest on-demand");
  });

  it("lists the top 3 with honest labels, cost differences, fit and risk", async () => {
    await openResults();
    const cards = within(document.getElementById("options")!).getAllByRole("listitem").filter((li) => li.querySelector(".rank"));
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Best overall");
    expect(cards[1]).toHaveTextContent("Flexible alternative"); expect(cards[1]).toHaveTextContent("+$93.20 / month"); expect(cards[1]).toHaveTextContent("Workload fit100%");
    expect(cards[2]).toHaveTextContent("Interruptible alternative"); expect(cards[2]).toHaveTextContent("Interruption riskMedium"); expect(cards[2]).toHaveTextContent("Workload fit50%");
  });

  it("shows savings vs each on-demand baseline and labels the annual figure as an estimate", async () => {
    await openResults();
    const sec = within(document.getElementById("savings")!);
    expect(sec.getByText(/Save \$53\.26/)).toBeInTheDocument();
    expect(sec.getByText("$639 / year")).toBeInTheDocument();
    expect(sec.getByText("No compatible on-demand option")).toBeInTheDocument();
    expect(sec.getByText("Annualized (estimate)")).toBeInTheDocument();
    expect(sec.getByText(/Assumes the workload and pricing remain unchanged for 12 months/)).toBeInTheDocument();
  });

  it("shows the egress insight only when the numbers support it", async () => {
    await openResults();
    const ins = within(document.getElementById("egress")!);
    expect(ins.getByRole("heading", { name: "Network costs changed the result" })).toBeInTheDocument();
    expect(document.getElementById("egress")).toHaveTextContent("$6.90 cheaper at GCP");
    expect(document.getElementById("egress")).toHaveTextContent("$102.60 more at GCP");
    expect(document.getElementById("egress")).toHaveTextContent("$95.70 / month higher");
  });

  it("hides the egress insight when no candidate has cheaper compute but a higher total", async () => {
    await openResults(responseNoEgress);
    expect(screen.queryByText("Network costs changed the result")).not.toBeInTheDocument();
  });

  it("shows resource fit, pricing-model trade-offs from the data, and the cost vs fit chart", async () => {
    await openResults();
    expect(screen.getByText("Very close resource match: little capacity is being paid for but unused.")).toBeInTheDocument();
    const pm = within(screen.getByRole("region", { name: "Pricing model comparison table" }));
    expect(pm.getByText("$111.80 / mo")).toBeInTheDocument(); // reserved cheapest
    expect(pm.getByText(/12-month commitment/)).toBeInTheDocument();
    expect(pm.getByText(/alternative only: your workload isn't interruption tolerant/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Scatter chart of 4 compatible options/ })).toBeInTheDocument();
    expect(screen.getByText(/Upper-left options provide a stronger combination/)).toBeInTheDocument();
  });

  it("shows at most five reasons and lists the included pricing models in the assumptions", async () => {
    const six = { ...response, best_overall: { ...response.best_overall, explanation: { ...response.best_overall.explanation,
      reasons: ["Satisfies the requested 4 vCPU / 16 GB RAM.", "Estimated $111.80/month = compute $86.90.", "Resource fit: 100%.", "Pricing model suitability: 1.0.",
        "Interruption risk: low.", "Outbound data is 15% of the total."] } } };
    await openResults({ ...six, recommendations: [six.best_overall, response.recommendations[1], response.recommendations[2]] });
    const items = within(document.getElementById("why")!).getAllByRole("listitem");
    expect(items.length).toBeLessThanOrEqual(5);
    expect(document.getElementById("why")).toHaveTextContent("Outbound data is 15% of the total.");
    expect(document.getElementById("why")).not.toHaveTextContent("Interruption risk: low.");
    await userEvent.click(screen.getByRole("button", { name: /Show all assumptions/ }));
    expect(document.getElementById("assumptions")).toHaveTextContent("Pricing models included in this comparison: Reserved/Committed, On-Demand, Spot/Preemptible.");
  });

  it("assumptions are collapsible, with key facts always visible", async () => {
    await openResults();
    const sec = within(document.getElementById("assumptions")!);
    expect(sec.getByText("Currency: USD")).toBeInTheDocument(); expect(sec.getByText("Pricing snapshot: Oct 19, 2026")).toBeInTheDocument();
    expect(sec.queryByText("Why this matters")).not.toBeInTheDocument();
    await userEvent.click(sec.getByRole("button", { name: /Show all assumptions/ }));
    expect(sec.getByText("Runtime assumption: 720 hours per month.")).toBeInTheDocument();
    expect(sec.getByText("Why this matters")).toBeInTheDocument();
  });

  it("raw candidate table filters, searches and sorts", async () => {
    await openResults();
    const sec = document.getElementById("all")!;
    const s = within(sec);
    const bodyRows = () => within(s.getByRole("table")).getAllByRole("row").slice(1);
    expect(bodyRows()).toHaveLength(4);
    await userEvent.selectOptions(s.getByLabelText("Provider"), "AWS");
    expect(bodyRows()).toHaveLength(1); expect(bodyRows()[0]).toHaveTextContent("m5.xlarge");
    await userEvent.selectOptions(s.getByLabelText("Provider"), "");
    await userEvent.selectOptions(s.getByLabelText("Pricing model"), "spot");
    expect(bodyRows()).toHaveLength(1); expect(bodyRows()[0]).toHaveTextContent("n2-standard-8");
    await userEvent.selectOptions(s.getByLabelText("Pricing model"), "");
    await userEvent.type(s.getByLabelText("Search"), "n2-standard-4");
    expect(bodyRows()).toHaveLength(1);
    await userEvent.clear(s.getByLabelText("Search"));
    await userEvent.selectOptions(s.getByLabelText("Sort by"), "cost");
    expect(bodyRows()[0]).toHaveTextContent("D4s_v3");
    await userEvent.selectOptions(s.getByLabelText("Region"), "us-central1");
    await userEvent.type(s.getByLabelText("Search"), "zzz");
    expect(s.getByText("No options match these filters")).toBeInTheDocument();
    await userEvent.click(s.getByRole("button", { name: "Clear filters" }));
    expect(bodyRows()).toHaveLength(4);
  });

  it("table has the required columns", async () => {
    await openResults();
    const heads = within(document.getElementById("all")!).getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(["Rank", "Provider", "Region", "Instance", "vCPU", "RAM", "Pricing model", "Compute", "Storage", "Egress", "Total", "Savings", "Fit"]);
  });

  it("Modify this analysis returns to the review step with the same values; New analysis resets", async () => {
    await openResults();
    await userEvent.click(screen.getByRole("button", { name: "Modify this analysis" }));
    expect(await screen.findByRole("heading", { name: "Review your workload" })).toBeInTheDocument();
    expect(document.body.textContent).toContain("200 GB SSD");
    await userEvent.click(screen.getByRole("button", { name: /Compare Cloud Options/ }));
    await screen.findByRole("heading", { name: "Why we recommend this" });
    await userEvent.click(screen.getByRole("button", { name: "New analysis" }));
    expect(await screen.findByRole("heading", { name: "What are you planning to run?" })).toBeInTheDocument();
    expect(screen.getByLabelText("vCPU")).toHaveValue(null);
  });

  it("saves an analysis and lists it under My Analyses", async () => {
    await openResults();
    await userEvent.click(screen.getByRole("button", { name: "Save analysis" }));
    const name = screen.getByLabelText("Analysis name");
    await userEvent.clear(name); await userEvent.type(name, "Production API workload");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
    await userEvent.click(primaryNav().getByRole("link", { name: "My Analyses" }));
    const row = (await screen.findByRole("link", { name: "Production API workload" })).closest("tr")!;
    expect(row).toHaveTextContent("Azure"); expect(row).toHaveTextContent("$112/month"); expect(row).toHaveTextContent("32.3% estimated savings");
    const stored = JSON.parse(localStorage.getItem("cloudwise.analyses.v1")!);
    expect(stored[0]).toMatchObject({ name: "Production API workload", workload: { vcpu: 4 } });
    expect(stored[0].result.pricing_snapshot_date).toBe("2026-10-19"); expect(stored[0].created_at).toBeTruthy();
    await userEvent.click(screen.getByRole("link", { name: "Production API workload" }));
    expect(await screen.findByRole("heading", { name: "Why we recommend this" })).toBeInTheDocument();
  });

  it("deleting a saved analysis needs confirmation and then shows the empty state", async () => {
    await openResults();
    await userEvent.click(screen.getByRole("button", { name: "Save analysis" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(primaryNav().getByRole("link", { name: "My Analyses" }));
    await userEvent.click(await screen.findByRole("button", { name: /Delete/ }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByText("No analyses yet")).toBeInTheDocument();
  });
});

describe("error and empty states", () => {
  it("My Analyses empty state invites the first analysis", async () => {
    mockApi({ body: response }); await renderApp("/analyses");
    expect(screen.getByText("No analyses yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first workload analysis to compare AWS, Azure, and Google Cloud.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start an analysis" })).toHaveAttribute("href", "/analysis/new");
  });

  it("no-candidate state is friendly, offers recovery actions, and hides the raw backend text", async () => {
    mockApi({ status: 422, body: { error: "no_compatible_candidates", message: "No pricing records satisfy the requested GPU/resource requirements." } });
    await renderApp("/");
    await userEvent.click(screen.getByRole("button", { name: "View Example Analysis" }));
    expect(await screen.findByText("No compatible resources found")).toBeInTheDocument();
    expect(screen.getByText(/couldn't find a pricing record that satisfies your current CPU, memory, GPU, or region requirements/)).toBeInTheDocument();
    expect(screen.queryByText(/No pricing records satisfy/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Change region" }));
    expect(await screen.findByRole("heading", { name: "How will this workload behave?" })).toBeInTheDocument();
  });

  it("'Edit workload' from the error state returns to step 1 with values intact", async () => {
    mockApi({ status: 422, body: { error: "no_compatible_candidates", message: "x" } });
    await renderApp("/");
    await userEvent.click(screen.getByRole("button", { name: "View Example Analysis" }));
    await userEvent.click(await screen.findByRole("button", { name: "Edit workload" }));
    expect(screen.getByLabelText("vCPU")).toHaveValue(4);
  });

  it("an unreachable backend produces a retryable message, not a blank page", async () => {
    mockApi("network", "network");
    await renderApp("/");
    await userEvent.click(screen.getByRole("button", { name: "View Example Analysis" }));
    expect(await screen.findByText("The advisor service isn't reachable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("pricing data and methodology pages", () => {
  it("pricing explorer shows records, snapshot, source, and filters", async () => {
    mockApi({ body: response }); await renderApp("/pricing");
    expect((await screen.findAllByText("m5.large")).length).toBeGreaterThan(0);
    expect(screen.getByText(/not live pricing/)).toBeInTheDocument();
    expect(screen.getByText("Data source")).toBeInTheDocument(); expect(screen.getAllByText("Snapshot date").length).toBeGreaterThan(0);
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    const all = rows().length;
    await userEvent.selectOptions(screen.getByLabelText("Provider"), "GCP");
    expect(rows().length).toBeLessThan(all); rows().forEach((r) => expect(r).toHaveTextContent("GCP"));
    await userEvent.selectOptions(screen.getByLabelText("Pricing model"), "spot");
    expect(await screen.findByText("No records match these filters")).toBeInTheDocument();
  });

  it("pricing explorer shows a retryable error if the API is down", async () => {
    mockApi({ body: response }, "network"); await renderApp("/pricing");
    expect(await screen.findByText("Pricing data couldn't be loaded")).toBeInTheDocument();
  });

  it("methodology lists the seven sections and the real formulas", async () => {
    mockApi({ body: response }); await renderApp("/methodology");
    for (const n of ["1. Workload requirements", "2. Candidate matching", "3. Cost calculation", "4. Pricing-model suitability", "5. Recommendation ranking", "6. Explainability", "7. Limitations"]) expect(screen.getByRole("heading", { name: n })).toBeInTheDocument();
    const flat = document.body.textContent!.replace(/\s+/g, " ");
    expect(flat).toContain("Egress cost = outbound GB × egress price per GB");
    expect(flat).toContain("Total = compute + storage + egress + ingress");
    expect(flat).toContain("Compute (On-Demand) = hourly price × monthly runtime");
  });
});
