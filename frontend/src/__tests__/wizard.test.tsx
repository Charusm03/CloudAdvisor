import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi, renderApp } from "./utils";
import { response } from "./fixtures";

beforeEach(() => { localStorage.clear(); mockApi({ body: response }); });
afterEach(() => vi.unstubAllGlobals());

const cont = () => userEvent.click(screen.getByRole("button", { name: /Continue/ }));
async function toStep3() {
  await renderApp("/analysis/new");
  await userEvent.click(screen.getByRole("button", { name: "Try an example" }));
  await cont(); await cont();
  await screen.findByRole("heading", { name: "How will this workload behave?" });
}

describe("workload wizard", () => {
  it("starts on step 1 with the 5-step progress indicator", async () => {
    await renderApp("/analysis/new");
    expect(screen.getByRole("heading", { name: "What are you planning to run?" })).toBeInTheDocument();
    const stepper = screen.getByRole("navigation", { name: "Analysis progress" });
    for (const t of ["Workload", "Storage & Network", "Usage & Pricing", "Review", "Results"]) expect(stepper).toHaveTextContent(t);
    expect(stepper.querySelector('[aria-current="step"]')).toHaveTextContent("Workload");
    expect(screen.getByText(/minimum resources your workload requires/)).toBeInTheDocument();
  });

  it("shows a live resource summary as the user types", async () => {
    await renderApp("/analysis/new");
    await userEvent.type(screen.getByLabelText("vCPU"), "4");
    await userEvent.type(screen.getByLabelText("RAM"), "16");
    const aside = screen.getByRole("complementary", { name: "Requested resources" });
    expect(aside).toHaveTextContent("4 vCPU"); expect(aside).toHaveTextContent("16 GB");
  });

  it("validates the step before continuing and associates errors with fields", async () => {
    await renderApp("/analysis/new");
    await cont();
    expect(screen.getByText("vCPU is required")).toBeInTheDocument();
    expect(screen.getByLabelText("vCPU")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("vCPU")).toHaveAccessibleDescription(/vCPU is required/);
    expect(screen.getByRole("heading", { name: "What are you planning to run?" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("vCPU"), "-2");
    await userEvent.type(screen.getByLabelText("RAM"), "16");
    await cont();
    expect(screen.getByText("vCPU must be greater than 0")).toBeInTheDocument();
  });

  it("navigates forward and back, keeping values", async () => {
    await renderApp("/analysis/new");
    await userEvent.type(screen.getByLabelText("vCPU"), "8");
    await userEvent.type(screen.getByLabelText("RAM"), "32");
    await cont();
    expect(await screen.findByRole("heading", { name: "How much data will your workload handle?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByLabelText("vCPU")).toHaveValue(8);
  });

  it("step 2 has SSD/HDD segmented control and distinct inbound/outbound fields with the egress explanation", async () => {
    await renderApp("/analysis/new");
    await userEvent.click(screen.getByRole("button", { name: "Try an example" }));
    await cont();
    expect(screen.getByRole("radio", { name: "SSD" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "HDD" }));
    expect(screen.getByRole("radio", { name: "HDD" })).toBeChecked();
    expect(screen.getByLabelText("Inbound")).toHaveValue(100);
    expect(screen.getByLabelText("Outbound / Egress")).toHaveValue(1000);
    expect(screen.getByText("Why does outbound data matter?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "What is egress?" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Data leaving a cloud provider");
  });

  it("step 2 requires non-negative transfer values", async () => {
    await renderApp("/analysis/new");
    await userEvent.click(screen.getByRole("button", { name: "Try an example" }));
    await cont();
    await userEvent.clear(screen.getByLabelText("Outbound / Egress"));
    await cont();
    expect(screen.getByText("Outbound transfer is required")).toBeInTheDocument();
  });

  it("GPU type options appear only when a GPU is required, and only for types in the dataset", async () => {
    await toStep3();
    expect(screen.queryByRole("group", { name: "GPU type" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    expect(await screen.findByRole("radio", { name: "T4" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "A100" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "A10" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "L4" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    expect(screen.queryByRole("radio", { name: "T4" })).not.toBeInTheDocument();
  });

  it("requires choosing a GPU type once GPU = Yes", async () => {
    await toStep3();
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await cont();
    expect(await screen.findByText("Choose a GPU type")).toBeInTheDocument();
  });

  it("choosing GPU-intensive switches the GPU requirement on; turning GPU off resets that pattern", async () => {
    await toStep3();
    await userEvent.click(screen.getByRole("radio", { name: /GPU-intensive/ }));
    expect(screen.getByRole("radio", { name: "Yes" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    expect(screen.getByRole("radio", { name: /Steady-state/ })).toBeChecked();
  });

  it("interruption tolerance uses two selectable cards, defaulting to 'No'", async () => {
    await toStep3();
    const no = screen.getByRole("radio", { name: /No: reliability is important/ });
    const yes = screen.getByRole("radio", { name: /Yes: lower cost is worth interruption risk/ });
    expect(no).toBeChecked();
    await userEvent.click(yes);
    expect(yes).toBeChecked(); expect(no).not.toBeChecked();
  });

  it("runtime presets set the value; runtime above 730 is blocked", async () => {
    await toStep3();
    expect(screen.getByText("Maximum: 730 hours/month")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "160 h" }));
    expect(screen.getByLabelText("Expected monthly runtime")).toHaveValue(160);
    await userEvent.clear(screen.getByLabelText("Expected monthly runtime"));
    await userEvent.type(screen.getByLabelText("Expected monthly runtime"), "800");
    await cont();
    expect(screen.getByText("Runtime must be at most 730 hours")).toBeInTheDocument();
  });

  it("region choices are grouped by provider and come from the pricing data", async () => {
    await toStep3();
    expect(screen.getByRole("radio", { name: /Any supported region/ })).toBeChecked();
    for (const g of ["AWS", "Azure", "Google Cloud"]) expect(screen.getByRole("group", { name: g })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("radio", { name: "us-east-1" }));
    expect(screen.getByRole("radio", { name: "us-east-1" })).toBeChecked();
  });

  it("review screen summarises every section and each Edit link returns to the right step", async () => {
    await toStep3();
    await cont();
    expect(await screen.findByRole("heading", { name: "Review your workload" })).toBeInTheDocument();
    const text = document.body.textContent!;
    for (const t of ["4 vCPU", "16 GB RAM", "200 GB SSD", "100 GB inbound", "1,000 GB outbound", "Steady-state", "720 hours/month", "Not tolerated", "Any supported region"]) expect(text).toContain(t);
    await userEvent.click(screen.getByRole("button", { name: "Edit Storage" }));
    expect(await screen.findByRole("heading", { name: "How much data will your workload handle?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Storage capacity")).toHaveValue(200);
  });

  it("Compare Cloud Options runs the analysis with progress, then shows the results", async () => {
    await toStep3(); await cont();
    await userEvent.click(await screen.findByRole("button", { name: /Compare Cloud Options/ }));
    expect(await screen.findByRole("heading", { name: "Why we recommend this" })).toBeInTheDocument();
    const call = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes("/preview"))!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toMatchObject({ gpu_required: false, gpu_type: null, gpu_count: 0, interruption_tolerant: false, preferred_region: "any" });
  });

  it("shows the staged progress list while waiting for the backend", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("/api/pricing")) return new Response("[]");
      await gate; return new Response(JSON.stringify(response));
    }));
    await toStep3(); await cont();
    await userEvent.click(await screen.findByRole("button", { name: /Compare Cloud Options/ }));
    expect(await screen.findByText("Analyzing workload…")).toBeInTheDocument();
    for (const s of ["Validating requirements", "Matching compatible instances", "Calculating provider costs", "Comparing pricing models", "Generating recommendation"]) expect(screen.getByText(s)).toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Why we recommend this" })).toBeInTheDocument());
  });
});
