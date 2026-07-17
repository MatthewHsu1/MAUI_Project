import { describe, expect, it } from "vitest";
import {
  buildDisplayModel,
  buildFlatModel,
  detectBoundaries,
  displayToData,
  type Boundary,
} from "./displayModel";

const order = (g: number) => g;

describe("detectBoundaries", () => {
  it("emits a boundary at index 0 and at each group change", () => {
    const rows = [{ g: 0 }, { g: 0 }, { g: 1 }];
    const b = detectBoundaries(rows, null, 0, (r) => r.g);
    expect(b).toEqual([
      { dataIndex: 0, group: 0 },
      { dataIndex: 2, group: 1 },
    ]);
  });
});

describe("buildDisplayModel (grouped)", () => {
  it("inserts one header per group; header at segment start, data after", () => {
    const boundaries: Boundary<number>[] = [
      { dataIndex: 0, group: 0 },
      { dataIndex: 2, group: 1 },
    ];
    const m = buildDisplayModel(
      { boundaries, total: 3, collapsedGroups: [], discoveredGroups: [0, 1] },
      order,
    );
    // header(0) d d header(1) d  => 5 display rows
    expect(m.rowCount).toBe(5);
    expect(displayToData(m, 0)).toEqual({ kind: "header", group: 0 });
    expect(displayToData(m, 1)).toEqual({ kind: "data", dataIndex: 0 });
    expect(displayToData(m, 3)).toEqual({ kind: "header", group: 1 });
    expect(displayToData(m, 4)).toEqual({ kind: "data", dataIndex: 2 });
  });
});

describe("buildFlatModel (ungrouped)", () => {
  it("has no headers; display index === data index", () => {
    const m = buildFlatModel(3);
    expect(m.rowCount).toBe(3);
    expect(displayToData(m, 0)).toEqual({ kind: "data", dataIndex: 0 });
    expect(displayToData(m, 2)).toEqual({ kind: "data", dataIndex: 2 });
  });
});
