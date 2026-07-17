import { GridCellKind } from "@glideapps/glide-data-grid";
import { describe, expect, it } from "vitest";
import { createNumberCell } from "./createNumberCell";

const cell = createNumberCell({ kind: "num-test", min: 0, max: 100 });
const nullableCell = createNumberCell({
  kind: "num-nullable-test",
  nullable: true,
  min: 0,
  max: 100,
});

describe("createNumberCell", () => {
  it("makeCell builds a custom cell with kind, numeric value, and string copyData", () => {
    const c = cell.makeCell(42.5);
    expect(c.kind).toBe(GridCellKind.Custom);
    expect(c.data).toEqual({ kind: "num-test", value: 42.5 });
    expect(c.copyData).toBe("42.5");
  });

  it("makeCell(null) builds a cleared cell with null value and empty copyData", () => {
    const c = cell.makeCell(null);
    expect(c.data).toEqual({ kind: "num-test", value: null });
    expect(c.copyData).toBe("");
  });

  it("the renderer matches its own cell kind and not a foreign one", () => {
    expect(cell.renderer.isMatch(cell.makeCell(1))).toBe(true);
    expect(cell.renderer.isMatch(nullableCell.makeCell(1))).toBe(false);
  });

  it("validate blocks empty when not nullable, allows it when nullable", () => {
    expect(cell.validate(cell.makeCell(null))).toBe(false);
    expect(nullableCell.validate(nullableCell.makeCell(null))).toBe(true);
  });

  it("validate accepts in-range and rejects out-of-range values", () => {
    expect(cell.validate(cell.makeCell(50))).toBe(true);
    expect(cell.validate(cell.makeCell(500))).toBe(false);
  });

  it("onPaste parses a separated string and rejects junk / out-of-range", () => {
    const onPaste = cell.renderer.onPaste!;
    const data = cell.makeCell(null).data;
    expect(onPaste("50", data)).toEqual({ kind: "num-test", value: 50 });
    expect(onPaste("garbage", data)).toBeUndefined();
    expect(onPaste("500", data)).toBeUndefined();
  });

  it("onPaste rejects empty when not nullable but clears when nullable", () => {
    expect(cell.renderer.onPaste!("   ", cell.makeCell(1).data)).toBeUndefined();
    expect(nullableCell.renderer.onPaste!("   ", nullableCell.makeCell(1).data)).toEqual({
      kind: "num-nullable-test",
      value: null,
    });
  });
});

describe("createNumberCell.makeCell allowOverlay", () => {
  it("disables the overlay when allowOverlay is false", () => {
    expect(cell.makeCell(1, false).allowOverlay).toBe(false);
  });

  it("allows the overlay by default", () => {
    expect(cell.makeCell(1).allowOverlay).toBe(true);
  });
});
