import { GridCellKind } from "@glideapps/glide-data-grid";
import { describe, expect, it } from "vitest";
import { createTextCell } from "./createTextCell";

const cell = createTextCell({ kind: "text-test", validation: { required: true, maxLength: 5 } });
const optional = createTextCell({ kind: "text-optional", validation: { email: true } });

describe("createTextCell", () => {
  it("makeCell builds a custom cell with kind, value, and string copyData", () => {
    const c = cell.makeCell("hi");
    expect(c.kind).toBe(GridCellKind.Custom);
    expect(c.data).toEqual({ kind: "text-test", value: "hi" });
    expect(c.copyData).toBe("hi");
  });

  it("makeCell(null) builds a cleared cell with null value and empty copyData", () => {
    const c = cell.makeCell(null);
    expect(c.data).toEqual({ kind: "text-test", value: null });
    expect(c.copyData).toBe("");
  });

  it("the renderer matches its own cell kind and not a foreign one", () => {
    expect(cell.renderer.isMatch(cell.makeCell("a"))).toBe(true);
    expect(cell.renderer.isMatch(optional.makeCell("a"))).toBe(false);
  });

  it("validate blocks empty when required, allows it when optional", () => {
    expect(cell.validate(cell.makeCell(null))).toBe(false);
    expect(optional.validate(optional.makeCell(null))).toBe(true);
  });

  it("validate enforces the configured rules (maxLength / email)", () => {
    expect(cell.validate(cell.makeCell("hello"))).toBe(true);
    expect(cell.validate(cell.makeCell("toolong"))).toBe(false);
    expect(optional.validate(optional.makeCell("a@b.co"))).toBe(true);
    expect(optional.validate(optional.makeCell("nope"))).toBe(false);
  });

  it("onPaste trims and stores the value, clearing to null when empty", () => {
    const onPaste = cell.renderer.onPaste!;
    const data = cell.makeCell(null).data;
    expect(onPaste("  hey  ", data)).toEqual({ kind: "text-test", value: "hey" });
    expect(onPaste("   ", data)).toEqual({ kind: "text-test", value: null });
  });
});

describe("createTextCell.makeCell allowOverlay", () => {
  it("disables the overlay when allowOverlay is false", () => {
    expect(cell.makeCell("a", false).allowOverlay).toBe(false);
  });
  it("allows the overlay by default", () => {
    expect(cell.makeCell("a").allowOverlay).toBe(true);
  });
  it("flags the cell read-only (draws — for empty) when the overlay is disabled", () => {
    expect(cell.makeCell(null, false).data.readOnly).toBe(true);
  });
  it("leaves an editable cell unflagged so an empty value stays blank", () => {
    expect(cell.makeCell("a").data.readOnly).toBeUndefined();
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
const rect = { x: 0, y: 0, width: 120, height: 34 };
const drawArgs = (ctx: CanvasRenderingContext2D) =>
  ({ ctx, rect, theme }) as unknown as Parameters<typeof cell.renderer.draw>[0];

describe("createTextCell draw", () => {
  it("draws an em dash for a read-only empty cell", () => {
    const { ctx, calls } = fakeCtx();
    cell.renderer.draw(drawArgs(ctx), cell.makeCell(null, false));
    expect(calls).toEqual(["—"]);
  });

  it("draws nothing for an editable empty cell", () => {
    const { ctx, calls } = fakeCtx();
    cell.renderer.draw(drawArgs(ctx), cell.makeCell(null));
    expect(calls).toEqual([]);
  });

  it("draws the text for a non-empty cell", () => {
    const { ctx, calls } = fakeCtx();
    cell.renderer.draw(drawArgs(ctx), cell.makeCell("hi", false));
    expect(calls).toEqual(["hi"]);
  });
});
