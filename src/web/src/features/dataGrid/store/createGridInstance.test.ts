// src/features/dataGrid/store/createGridInstance.test.ts
import { describe, expect, it } from "vitest";
import { createGridInstance } from "./createGridInstance";
import type { GridDescriptor } from "../types";

interface Row {
  id: number;
}
const descriptor = {
  name: "demo",
  rowKey: (r: Row) => r.id,
  columns: {
    defs: { id: { field: "id", title: "Id", defaultWidth: 80, editable: false, type: "number" } },
    defaultOrder: ["id"],
  },
  api: {
    fetchWindow: async () => ({ rows: [], total: 0, precedingGroupKey: null }),
    updateRow: async () => ({ ok: true }),
  },
  cells: { makeCell: () => ({}) as never, customRenderers: [], validateCell: () => true },
} as unknown as GridDescriptor<Row, number>;

describe("createGridInstance", () => {
  it("produces a combined reducer with all five sub-slices", () => {
    const inst = createGridInstance(descriptor);
    const state = inst.reducer(undefined, { type: "@@init" });
    expect(Object.keys(state).sort()).toEqual([
      "columns",
      "edits",
      "gridData",
      "groups",
      "selection",
    ]);
  });

  it("selectRoot reads the namespaced slice from a full store state", () => {
    const inst = createGridInstance(descriptor);
    const sub = inst.reducer(undefined, { type: "@@init" });
    expect(inst.selectRoot({ demo: sub }).columns.order).toEqual(["id"]);
  });

  it("exposes listener middleware and a loadColumns thunk", () => {
    const inst = createGridInstance(descriptor);
    expect(typeof inst.middleware).toBe("function");
    expect(typeof inst.thunks.loadColumns).toBe("function");
  });
});
