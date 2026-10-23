import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi, renderApp } from "./utils";
import { response } from "./fixtures";

beforeEach(() => { localStorage.clear(); mockApi({ body: response }); });
afterEach(() => vi.unstubAllGlobals());

describe("landing / overview", () => {
  it("renders the hero and the purpose statement", async () => {
    await renderApp();
    expect(screen.getByRole("heading", { level: 1, name: "Choose the right cloud before you deploy." })).toBeInTheDocument();
    expect(screen.getByText(/Compare AWS, Azure, and Google Cloud against your actual workload requirements/)).toBeInTheDocument();
  });

  it("explains what the app does visually: workload → engine → providers → best fit", async () => {
    await renderApp();
    const flow = screen.getByRole("figure");
    for (const t of ["CPU", "RAM", "Storage", "Network", "Advisor engine", "Best fit"]) expect(within(flow).getByText(t)).toBeInTheDocument();
  });

  it("shows how it works (4 steps) and why compare before deployment (3 problems)", async () => {
    await renderApp();
    const how = screen.getByRole("region", { name: "How it works" });
    for (const t of ["Describe", "Compare", "Calculate", "Decide"]) expect(within(how).getByRole("heading", { name: t })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why compare before deployment?" })).toBeInTheDocument();
    expect(screen.getByText("Cloud prices are not directly comparable")).toBeInTheDocument();
    expect(screen.getByText("The cheapest VM is not always the cheapest workload")).toBeInTheDocument();
    expect(screen.getByText("Pricing models have trade-offs")).toBeInTheDocument();
  });

  it("renders three neutral provider cards", async () => {
    await renderApp();
    const sec = screen.getByRole("region", { name: /Three providers/ });
    expect(within(sec).getByText("Compare compatible EC2-style compute options and pricing models.")).toBeInTheDocument();
    expect(within(sec).getByText("Compare Azure VM options across supported regions and pricing models.")).toBeInTheDocument();
    expect(within(sec).getByText("Compare Compute Engine options and applicable pricing models.")).toBeInTheDocument();
    expect(within(sec).getAllByText("Compute")).toHaveLength(3);
  });

  it("primary CTA opens the guided wizard", async () => {
    await renderApp();
    await userEvent.click(screen.getAllByRole("link", { name: /Start a Cost Analysis/ })[0]);
    expect(await screen.findByRole("heading", { name: "What are you planning to run?" })).toBeInTheDocument();
  });

  it("'View Example Analysis' loads the demo workload and runs it against the API", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: "View Example Analysis" }));
    expect(await screen.findByRole("heading", { name: "Why we recommend this" })).toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes("/preview"))!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toMatchObject({ vcpu: 4, ram_gb: 16, storage_gb: 200, monthly_data_transfer_out_gb: 1000 });
  });

  it("app shell exposes all five destinations and the snapshot date; never claims AI", async () => {
    await renderApp();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const t of ["Overview", "New Analysis", "My Analyses", "Pricing Data", "Methodology"]) expect(within(nav).getByRole("link", { name: t })).toBeInTheDocument();
    expect(await screen.findByText("Oct 19, 2026")).toBeInTheDocument();
    expect(screen.getByText("Prototype")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/AI recommends|AI-powered|AI confidence/i);
  });
});
