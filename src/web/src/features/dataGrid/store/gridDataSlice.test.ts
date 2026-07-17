import { describe, expect, it } from "vitest";
import { createGridDataSlice } from "./gridDataSlice";
import type { GridDescriptor } from "../types";

interface Row {
  id: number;
  name: string;
}
const descriptor = {
  name: "test",
  rowKey: (r: Row) => r.id,
  columns: { defs: {}, defaultOrder: [] },
  api: {
    fetchWindow: async () => ({ rows: [{ id: 1, name: "a" }], total: 1, precedingGroupKey: null }),
    updateRow: async () => ({ ok: true }),
  },
  cells: { makeCell: () => ({}) as never, customRenderers: [], validateCell: () => true },
} as unknown as GridDescriptor<Row, number>;

describe("createGridDataSlice", () => {
  it("fulfilled stores rows by global index and sets total", () => {
    const { reducer, fetchWindow } = createGridDataSlice("test", descriptor);
    const s = reducer(undefined, {
      type: fetchWindow.fulfilled.type,
      payload: { skip: 0, rows: [{ id: 1, name: "a" }], total: 1, precedingGroupKey: null },
      meta: { arg: { skip: 0, take: 100 } },
    });
    expect(s.total).toBe(1);
    expect(s.byIndex[0]).toEqual({ id: 1, name: "a" });
  });

  it("applyEdit mutates an existing row in place", () => {
    const { reducer, actions } = createGridDataSlice("test", descriptor);
    let s = reducer(undefined, { type: "@@init" });
    s = { ...s, byIndex: { 0: { id: 1, name: "a" } } };
    s = reducer(s, actions.applyEdit({ dataIndex: 0, field: "name", value: "z" }));
    expect((s.byIndex[0] as Row).name).toBe("z");
  });
});
