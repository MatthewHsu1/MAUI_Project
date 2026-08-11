import { describe, expect, it } from "vitest";
import { rootReducer } from "../../app/rootReducer";
import { SECTORS } from "./api/types";
import { GRID_NAME, testGrid, testGridDescriptor } from "./testGrid";

describe("testGridDescriptor", () => {
  it("keys a row by its id", () => {
    expect(testGridDescriptor.rowKey({ id: 7 } as never)).toBe(7);
  });

  it("groups by sector, in the order SECTORS lists", () => {
    const grouping = testGridDescriptor.grouping!;

    expect(grouping.field).toBe("sector");
    expect(grouping.of({ sector: "Banking" } as never)).toBe("Banking");
    expect(grouping.label("Banking")).toBe("Banking");
    expect(grouping.order("Aerospace")).toBe(0);
    expect(grouping.order("Utilities")).toBe(SECTORS.length - 1);
  });

  it("keeps SECTORS ascending, which grouping.order depends on", () => {
    expect([...SECTORS]).toEqual([...SECTORS].sort());
  });

  it("lists every column def in the default order, and nothing else", () => {
    expect([...testGridDescriptor.columns.defaultOrder].sort()).toEqual(
      Object.keys(testGridDescriptor.columns.defs).sort(),
    );
  });

  it("marks the derived and identity columns read-only", () => {
    const defs = testGridDescriptor.columns.defs;

    expect(defs.id.editable).toBe(false);
    expect(defs.sector.editable).toBe(false);
    expect(defs.value.editable).toBe(false);
    expect(defs.quantity.editable).toBe(true);
    expect(defs.price.editable).toBe(true);
  });

  it("lets every column sort, including the read-only ones", () => {
    expect(testGridDescriptor.columns.sortable!("value")).toBe(true);
  });

  it("names a registered cell type on every column", () => {
    for (const def of Object.values(testGridDescriptor.columns.defs)) {
      expect(() =>
        testGridDescriptor.cells.makeCell(def.type, null, { editable: false, withTime: false }),
      ).not.toThrow();
    }
  });
});

describe("testGrid instance", () => {
  it("injects itself into the root reducer on import", () => {
    const state = rootReducer(undefined, { type: "@@init" });

    expect(testGrid.selectRoot(state).columns.order).toEqual(
      testGridDescriptor.columns.defaultOrder,
    );
    expect(GRID_NAME).toBe("testGrid");
  });

  it("starts with no collapsed sectors", () => {
    const state = rootReducer(undefined, { type: "@@init" });

    expect(testGrid.selectRoot(state).groups.collapsedGroups).toEqual([]);
  });
});
