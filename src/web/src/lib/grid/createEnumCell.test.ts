import { GridCellKind } from "@glideapps/glide-data-grid";
import { describe, expect, it } from "vitest";
import { createEnumCell } from "./createEnumCell";
import { radixColorByIndex } from "./radixBadgePalette";

const cell = createEnumCell({
  kind: "enum-test",
  options: [
    { value: 1, label: "One" },
    { value: 2, label: "Two", color: "red" },
  ],
});

const nullableCell = createEnumCell({
  kind: "enum-nullable-test",
  nullable: true,
  options: [
    { value: 1, label: "One" },
    { value: 2, label: "Two", color: "red" },
  ],
});

describe("createEnumCell", () => {
  it("makeCell builds a custom cell with kind, value, and label copyData", () => {
    const c = cell.makeCell(1);
    expect(c.kind).toBe(GridCellKind.Custom);
    expect(c.data).toEqual({ kind: "enum-test", value: 1 });
    expect(c.copyData).toBe("One");
  });

  it("colorOf uses the index default when no override is given", () => {
    expect(cell.colorOf(1)).toBe(radixColorByIndex(1));
  });

  it("colorOf prefers a per-value override over the index default", () => {
    expect(cell.colorOf(2)).toBe("red");
  });

  it("the renderer matches its own cell kind and not others", () => {
    const match = cell.renderer.isMatch(cell.makeCell(1));
    expect(match).toBe(true);
  });

  it("makeCell(null) builds a cleared cell with null value and empty copyData", () => {
    const c = nullableCell.makeCell(null);
    expect(c.data).toEqual({ kind: "enum-nullable-test", value: null });
    expect(c.copyData).toBe("");
  });
});

describe("createEnumCell.makeCell allowOverlay", () => {
  it("disables the overlay (no Select) when allowOverlay is false", () => {
    expect(cell.makeCell(1, false).allowOverlay).toBe(false);
  });

  it("allows the overlay by default", () => {
    expect(cell.makeCell(1).allowOverlay).toBe(true);
  });

  it("flags the cell read-only (draws — for empty) when the overlay is disabled", () => {
    expect(nullableCell.makeCell(null, false).data.readOnly).toBe(true);
  });

  it("leaves an editable cell unflagged so an empty value stays blank", () => {
    expect(cell.makeCell(1).data.readOnly).toBeUndefined();
  });
});

function fakeCtx() {
  const calls: string[] = [];
  const ctx = {
    font: "",
    fillStyle: "" as string,
    textBaseline: "alphabetic" as CanvasTextBaseline,
    fillText: (t: string) => {
      calls.push(t);
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const theme = {
  textDark: "#111",
  textLight: "#999",
  baseFontFull: "13px sans-serif",
  cellHorizontalPadding: 8,
};
const rect = { x: 0, y: 0, width: 160, height: 34 };
const drawArgs = (ctx: CanvasRenderingContext2D) =>
  ({ ctx, rect, theme }) as unknown as Parameters<typeof nullableCell.renderer.draw>[0];

describe("createEnumCell draw", () => {
  it("draws an em dash for a read-only empty cell", () => {
    const { ctx, calls } = fakeCtx();
    nullableCell.renderer.draw(drawArgs(ctx), nullableCell.makeCell(null, false));
    expect(calls).toEqual(["—"]);
  });

  it("draws nothing for an editable empty cell", () => {
    const { ctx, calls } = fakeCtx();
    nullableCell.renderer.draw(drawArgs(ctx), nullableCell.makeCell(null));
    expect(calls).toEqual([]);
  });
});
