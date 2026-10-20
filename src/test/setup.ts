import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

beforeAll(() => {
  if (process.env.TECHSTAGE_BLOCK_NETWORK === "true") {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Outbound network is blocked in tests"))));
  }
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

