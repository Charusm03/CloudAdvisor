/**
 * jsdom has no layout engine, so these are "layout contract" tests: they assert the DOM structure and the CSS
 * breakpoints the responsive behaviour relies on. Real rendering at each width is checked in a browser
 * (see README: npm run dev, then resize / devtools).
 */
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi, renderApp } from "./utils";
import { response } from "./fixtures";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

beforeEach(() => { localStorage.clear(); mockApi({ body: response }); });
afterEach(() => vi.unstubAllGlobals());

describe("responsive layout contract", () => {
  it.each([[1440, "desktop: sidebar + workspace"], [1024, "laptop"], [768, "tablet: collapsible sidebar"], [390, "phone"]])(
    "%ipx (%s): a CSS rule exists for this size range", (w) => {
      const maxes = [...css.matchAll(/@media \(max-width: (\d+)px\)/g)].map((m) => Number(m[1]));
      if (w >= 1440) expect(maxes.every((m) => m < 1440)).toBe(true); // desktop = default styles
      else expect(maxes.some((m) => m >= w)).toBe(true);
    });

  it("provides sidebar, header nav and mobile bottom nav", async () => {
    await renderApp();
    expect(screen.getByRole("complementary", { name: "Sidebar" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mobile" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.sidebar \{ display: none; \}/);
    expect(css).toMatch(/\.mobilenav \{ display: none; \}/);
  });

  it("sidebar can collapse and expand", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    window.innerWidth = 1440;
    await renderApp();
    const btn = screen.getByRole("button", { name: "Collapse sidebar" });
    await userEvent.click(btn);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".shell")).toHaveClass("is-collapsed");
  });

  it("wide tables scroll inside their own focusable container, never the whole page", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    await renderApp("/");
    await userEvent.click(screen.getByRole("button", { name: "View Example Analysis" }));
    await screen.findByRole("heading", { name: "Why we recommend this" });
    const region = screen.getByRole("region", { name: "All compatible options table" });
    expect(region).toHaveClass("table-scroll"); expect(region).toHaveAttribute("tabindex", "0");
    expect(within(region).getByRole("table")).toBeInTheDocument();
    expect(css).toMatch(/\.table-scroll \{ overflow-x: auto;/);
    expect(css).toMatch(/body \{[^}]*overflow-x: hidden/);
  });

  it("respects reduced motion and keeps animations short", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    for (const m of css.matchAll(/animation: [^;]*?(\d*\.?\d+)s/g)) expect(Number(m[1])).toBeLessThanOrEqual(1.2);
    expect(css).toMatch(/\.wizard \{ animation: stepin \.22s/); expect(css).toMatch(/animation: reveal \.3s/);
  });
});
