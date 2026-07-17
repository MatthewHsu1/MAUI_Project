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
