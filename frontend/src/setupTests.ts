import "@testing-library/jest-dom/vitest";

// jsdom does not implement scrolling
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

// Let in-flight pricing fetches settle inside act() so short tests don't leak state updates.
import { act } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); });
