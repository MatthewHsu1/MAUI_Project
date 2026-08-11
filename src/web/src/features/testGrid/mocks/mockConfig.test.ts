import { describe, expect, it } from "vitest";
import { mockConfig } from "./mockConfig";

describe("mockConfig", () => {
  it("ships a visible latency and NO injected failures", () => {
    // The failure rate matters: a grid that fails at random cannot be used to
    // test anything else, so the failure path is opt-in.
    expect(mockConfig).toEqual({ latencyMs: 150, failureRate: 0 });
  });
});
