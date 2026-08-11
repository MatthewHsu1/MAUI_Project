// @vitest-environment node
// This suite hand-stubs document/getComputedStyle rather than using jsdom's, so
// it needs the node environment the stubs were written against.
import { afterEach, describe, expect, it, vi } from "vitest";
import { drawSoftBadge, invalidateBadgeColorCache, resolveRadixSoft } from "./softBadge";

// --- DOM boundary stub (node env has no document / getComputedStyle) ---
// Mirrors the manual-stub approach used by colorSchemeWatcher.test.ts. Returns the
// getComputedStyle spy so tests can assert how often it is read.
function stubComputedStyle(getProp: (prop: string) => string) {
  globalThis.document = {
    querySelector: () => null,
    documentElement: {},
  } as unknown as Document;
  const gcs = vi.fn(() => ({ getPropertyValue: getProp }) as unknown as CSSStyleDeclaration);
  globalThis.getComputedStyle = gcs as unknown as typeof getComputedStyle;
  return gcs;
}

afterEach(() => {
  invalidateBadgeColorCache();
  vi.restoreAllMocks();
});

describe("resolveRadixSoft", () => {
  it("reads --{color}-a3 / -11 / -9 from the theme root", () => {
    stubComputedStyle((prop) => {
      if (prop === "--grass-a3") return "#11ff0040";
      if (prop === "--grass-11") return "#1a7a3a";
      if (prop === "--grass-9") return "#46a758";
      return "";
    });

    expect(resolveRadixSoft("grass")).toEqual({
      bg: "#11ff0040",
      text: "#1a7a3a",
      dot: "#46a758",
    });
  });

  it("caches a resolved scale (reads getComputedStyle once)", () => {
    const gcs = stubComputedStyle(() => "#46a758");

    resolveRadixSoft("grass");
    resolveRadixSoft("grass");

    expect(gcs).toHaveBeenCalledTimes(1);
  });

  it("warns once for an unresolved scale (empty vars) and does not cache it", () => {
    stubComputedStyle(() => "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const first = resolveRadixSoft("tomato");
    resolveRadixSoft("tomato");

    expect(first).toEqual({ bg: "", text: "", dot: "" });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("drawSoftBadge", () => {
  function fakeCtx() {
    const calls: string[] = [];
    const ctx = {
      font: "",
      fillStyle: "" as string | CanvasGradient | CanvasPattern,
      textBaseline: "alphabetic" as CanvasTextBaseline,
      measureText: (t: string) => ({ width: t.length * 6 }) as TextMetrics,
      beginPath: () => {
        calls.push("beginPath");
      },
      roundRect: () => {
        calls.push("roundRect");
      },
      arc: () => {
        calls.push("arc");
      },
      rect: () => {
        calls.push("rect");
      },
      clip: () => {
        calls.push("clip");
      },
      fill: () => {
        calls.push("fill");
      },
      save: () => {
        calls.push("save");
      },
      restore: () => {
        calls.push("restore");
      },
      fillText: (t: string) => {
        calls.push(`fillText:${t}`);
      },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, raw: ctx };
  }

  const rect = { x: 0, y: 0, width: 200, height: 34 };

  it("sets the font and paints pill, dot, and clipped label for a resolved scale", () => {
    stubComputedStyle(() => "#46a758");
    const { ctx, calls, raw } = fakeCtx();

    drawSoftBadge(ctx, rect, "grass", "Accepted", "13px sans-serif");

    expect(raw.font).toBe("13px sans-serif");
    expect(calls).toContain("roundRect");
    expect(calls).toContain("arc");
    expect(calls).toContain("fillText:Accepted");
  });

  it("draws nothing when the scale is unresolved", () => {
    stubComputedStyle(() => "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ctx, calls } = fakeCtx();

    drawSoftBadge(ctx, rect, "plum", "X", "13px sans-serif");

    expect(calls).toEqual([]);
  });

  it("draws nothing when the cell is too narrow", () => {
    stubComputedStyle(() => "#46a758");
    const { ctx, calls } = fakeCtx();

    drawSoftBadge(ctx, { x: 0, y: 0, width: 10, height: 34 }, "grass", "X", "13px sans-serif");

    expect(calls).toEqual([]);
  });
});
