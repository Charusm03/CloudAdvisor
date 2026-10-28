import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "../App";
import { pricing, pricingMeta } from "./fixtures";

export type PreviewReply = { status?: number; body: unknown } | "network";

/** Stub fetch: GET /api/pricing returns fixtures; POST preview returns `preview`. */
export function mockApi(preview: PreviewReply, pricingReply: PreviewReply = { body: pricing }) {
  const fn = vi.fn(async (url: string) => {
    if (String(url).includes("/api/pricing/meta")) return new Response(JSON.stringify(pricingMeta), { status: 200 });
    const reply = String(url).includes("/api/pricing") ? pricingReply : preview;
    if (reply === "network") throw new TypeError("network down");
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

export async function renderApp(route = "/") {
  const result = render(<MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); // let the pricing fetch settle
  return result;
}
