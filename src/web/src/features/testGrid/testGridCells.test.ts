import { describe, expect, it } from "vitest";
import { testGridCells } from "./testGridCells";

const ctx = { editable: true, withTime: false };
const readOnlyCtx = { editable: false, withTime: false };

describe("testGridCells", () => {
  it("registers every type the column defs use", () => {
    for (const type of ["int", "text", "currency", "region", "phone", "date", "active"]) {
      expect(() => testGridCells.makeCell(type, null, readOnlyCtx)).not.toThrow();
    }
  });

  it("opens an overlay for an editable cell and not for a read-only one", () => {
    expect(testGridCells.makeCell("currency", 12.5, ctx).allowOverlay).toBe(true);
    expect(testGridCells.makeCell("currency", 12.5, readOnlyCtx).allowOverlay).toBe(false);
  });

  it("maps a boolean to the active enum", () => {
    const cell = testGridCells.makeCell("active", true, ctx) as unknown as {
      data: { value: number };
    };
    expect(cell.data.value).toBe(1);

    const off = testGridCells.makeCell("active", false, ctx) as unknown as {
      data: { value: number };
    };
    expect(off.data.value).toBe(0);
  });

  it("carries one renderer per cell kind", () => {
    expect(testGridCells.customRenderers.length).toBeGreaterThanOrEqual(6);
  });
});
