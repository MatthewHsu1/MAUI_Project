import { describe, expect, it } from "vitest";
import { createGridDataSlice } from "./gridDataSlice";
import { createGroupsSlice } from "./groupsSlice";
import type { GridDescriptor } from "../types";

interface Row {
  id: number;
  g: number;
}
const base = {
  name: "test",
  rowKey: (r: Row) => r.id,
  columns: { defs: {}, defaultOrder: [] },
  api: {
    fetchWindow: async () => ({ rows: [], total: 0, precedingGroupKey: null }),
    updateRow: async () => ({ ok: true }),
  },
  cells: { makeCell: () => ({}) as never, customRenderers: [], validateCell: () => true },
};
const grouped = {
  ...base,
  grouping: { of: (r: Row) => r.g, order: (g: number) => g, label: String },
} as unknown as GridDescriptor<Row, number>;
const flat = base as unknown as GridDescriptor<Row, number>;

function fulfilled(rows: Row[]) {
  return {
    type: "test/gridData/fetchWindow/fulfilled",
    payload: { skip: 0, rows, total: rows.length, precedingGroupKey: null },
    meta: { arg: { skip: 0, take: 100 } },
  };
}

describe("createGroupsSlice", () => {
  it("discovers boundaries + groups when grouping is configured", () => {
    const gd = createGridDataSlice("test", grouped);
    const { reducer } = createGroupsSlice("test", grouped, gd.fetchWindow);
    const s = reducer(
      undefined,
      fulfilled([
        { id: 1, g: 0 },
        { id: 2, g: 1 },
      ]),
    );
    expect(s.boundaries).toEqual([
      { dataIndex: 0, group: 0 },
      { dataIndex: 1, group: 1 },
    ]);
    expect(s.discoveredGroups).toEqual([0, 1]);
  });

  it("is a no-op on fetch when grouping is absent", () => {
    const gd = createGridDataSlice("test", flat);
    const { reducer } = createGroupsSlice("test", flat, gd.fetchWindow);
    const s = reducer(undefined, fulfilled([{ id: 1, g: 0 }]));
    expect(s.boundaries).toEqual([]);
    expect(s.discoveredGroups).toEqual([]);
  });

  it("setSort clears boundaries for re-discovery", () => {
    const gd = createGridDataSlice("test", grouped);
    const { reducer, actions } = createGroupsSlice("test", grouped, gd.fetchWindow);
    let s = reducer(undefined, fulfilled([{ id: 1, g: 0 }]));
    s = reducer(s, actions.setSort({ field: "id", dir: "asc" }));
    expect(s.boundaries).toEqual([]);
    expect(s.sort).toEqual({ field: "id", dir: "asc" });
  });
});
