import { configureStore, type Reducer } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGridInstance } from "../createGridInstance";
import { appListener } from "../../../../app/listener";
import type { GridDescriptor, GridSliceState } from "../../types";

interface Row {
  id: number;
}

function makeDescriptor(name: string, saveColumns: (columns: unknown) => Promise<void>) {
  return {
    name,
    rowKey: (r: Row) => r.id,
    columns: {
      defs: { id: { field: "id", title: "Id", defaultWidth: 80, editable: false, type: "number" } },
      defaultOrder: ["id"],
    },
    api: {
      fetchWindow: async () => ({ rows: [], total: 0, precedingGroupKey: null }),
      updateRow: async () => ({ ok: true }),
      saveColumns,
    },
    cells: { makeCell: () => ({}) as never, customRenderers: [], validateCell: () => true },
  } as unknown as GridDescriptor<Row, number>;
}

function makeStore(name: string, reducer: Reducer<GridSliceState<Row, number>>) {
  return configureStore({
    reducer: { [name]: reducer },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false }).concat(appListener.middleware),
  });
}

describe("grid effects on the app listener", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs a grid's effects through the app listener, with no per-grid middleware", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const inst = createGridInstance(makeDescriptor("sharedDemo", save));
    const store = makeStore("sharedDemo", inst.reducer);

    store.dispatch(inst.actions.resizeColumn({ field: "id", width: 200 }));
    await vi.advanceTimersByTimeAsync(600);

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ widths: { id: 200 } }));

    inst.stopEffects();
  });

  it("stopEffects removes the grid's listeners from the app listener", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const inst = createGridInstance(makeDescriptor("stoppedDemo", save));
    const store = makeStore("stoppedDemo", inst.reducer);

    inst.stopEffects();
    store.dispatch(inst.actions.resizeColumn({ field: "id", width: 200 }));
    await vi.advanceTimersByTimeAsync(600);

    expect(save).not.toHaveBeenCalled();
  });
});
