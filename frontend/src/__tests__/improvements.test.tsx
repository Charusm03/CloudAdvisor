import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CostVsFitChart } from "../components/results/CostVsFitChart";
import { WhatIfPanel } from "../components/results/WhatIfPanel";
import { EMPTY_FORM, MAX_RUNTIME, toWorkload, validateForm } from "../services/validation";
import { response, workload } from "./fixtures";

describe("audit fixes", () => {
  it("runtime cap is 730 and vCPU must be a whole number", () => {
    expect(MAX_RUNTIME).toBe(730);
    const f = { ...EMPTY_FORM, vcpu: "2.5", ram_gb: "8", expected_runtime_hours_per_month: "731" };
    const e = validateForm(f);
    expect(e.vcpu).toMatch(/whole number/);
    expect(e.expected_runtime_hours_per_month).toBeTruthy();
  });

  it("GPU count is required when a GPU is requested and sent to the API", () => {
    const f = { ...EMPTY_FORM, gpu_required: true, gpu_type: "NVIDIA T4", gpu_count: "0" };
    expect(validateForm(f).gpu_count).toBeTruthy();
    expect(toWorkload({ ...f, gpu_count: "2" }).gpu_count).toBe(2);
    expect(toWorkload({ ...EMPTY_FORM }).gpu_count).toBe(0);
  });

  it("what-if panel recomputes automatically when an input changes", async () => {
    const onRecompute = vi.fn().mockResolvedValue(undefined);
    render(<WhatIfPanel workload={workload} onRecompute={onRecompute} />);
    const runtime = screen.getByLabelText(/Runtime/);
    await userEvent.clear(runtime);
    await userEvent.type(runtime, "300");
    await waitFor(() => expect(onRecompute).toHaveBeenCalled());
    expect(onRecompute.mock.calls[onRecompute.mock.calls.length - 1][0].expected_runtime_hours_per_month).toBe(300);
  });

  it("what-if panel does not call the API for invalid input", async () => {
    const onRecompute = vi.fn().mockResolvedValue(undefined);
    render(<WhatIfPanel workload={workload} onRecompute={onRecompute} />);
    const runtime = screen.getByLabelText(/Runtime/);
    fireEvent.change(runtime, { target: { value: "900" } });
    await new Promise((r) => setTimeout(r, 30));
    expect(onRecompute).not.toHaveBeenCalled();
  });

  it("chart explains when every option has the same fit, and stays quiet otherwise", () => {
    const base = response.candidates[0];
    const same = [base, { ...base, total_monthly_cost: base.total_monthly_cost + 20 }];
    const { unmount } = render(<CostVsFitChart candidates={same} best={base} />);
    expect(screen.getByRole("note")).toHaveTextContent(/same instance size/);
    unmount();
    render(<CostVsFitChart candidates={[base, { ...base, resource_fit_score: 0.6 }]} best={base} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
