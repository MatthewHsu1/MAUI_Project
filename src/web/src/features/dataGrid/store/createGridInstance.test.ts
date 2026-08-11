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
    fetchRows: async () => [],
    fetchCount: async () => 0,
    fetchRow: async () => null,
    updateRow: async () => ({ ok: true }),
  },
  cells: { makeCell: () => ({}) as never, customRenderers: [], validateCell: () => true },
} as unknown as GridDescriptor<Row, number>;

const makeInstance = () => createGridInstance(descriptor);

describe("createGridInstance", () => {
  it("reduces only client-owned state — rows live in the row store", () => {
    const inst = makeInstance();
    const state = inst.reducer(undefined, { type: "@@init" });
    expect(Object.keys(state).sort()).toEqual(["columns", "edits", "groups", "selection"]);
  });

  it("selectRoot reads the namespaced slice from a full store state", () => {
    const inst = makeInstance();
    const sub = inst.reducer(undefined, { type: "@@init" });
    expect(inst.selectRoot({ demo: sub }).columns.order).toEqual(["id"]);
  });

  it("exposes an effects teardown and a loadColumns thunk", () => {
    const inst = makeInstance();
    expect(typeof inst.stopEffects).toBe("function");
    expect(typeof inst.thunks.loadColumns).toBe("function");
    inst.stopEffects();
  });

  it("starts with an empty store cell, so a push before any grid mounts is dropped", () => {
    // The instance is created at module scope, long before a grid mounts, and
    // `useGridData` is what fills this cell. `data/sync/useRowSync.ts` relies on
    // the null: a push that arrives first has nothing on screen to correct.
    const inst = makeInstance();
    expect(inst.storeRef.current).toBeNull();
  });
});
