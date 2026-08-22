import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rootReducer } from "../../app/rootReducer";
import { appListener } from "../../app/listener";
import { fetchValuation, fetchValuationCount, fetchValuations } from "./api/bondQueries";
import { bondGrid, createBondGridApi, GRID_NAME } from "./bondGrid";
import type { ConversionValuation } from "./api/types";

// The adapter's whole job is to hand the grid's parameters to the right query
// function, so the query module is the seam these tests assert on. The
// transport has its own tests (src/lib/http), and the ORDER is the server's
// answer now, so there is nothing left here to re-sort or re-count.
vi.mock("./api/bondQueries", () => ({
  fetchValuations: vi.fn(),
  fetchValuationCount: vi.fn(),
  fetchValuation: vi.fn(),
}));

const sample: ConversionValuation[] = [
  {
    symbol: "B",
    conversionShares: 1,
    conversionValue: 300,
    stockPrice: 3,
    asOf: "2026-07-17",
    bondPrice: 110,
    isInTheMoney: true,
  },
  {
    symbol: "A",
    conversionShares: 2,
    conversionValue: 100,
    stockPrice: 1,
    asOf: "2026-07-17",
    bondPrice: null,
    isInTheMoney: null,
  },
];

/** The collection's default ask: the first window, unsorted. */
const wholeList = { offset: 0, limit: 10, sort: null, collapsedGroups: [] as never[] };

beforeEach(() => {
  vi.mocked(fetchValuations).mockReset().mockResolvedValue(sample);
  vi.mocked(fetchValuationCount).mockReset().mockResolvedValue(3);
  vi.mocked(fetchValuation).mockReset().mockResolvedValue(sample[0]);
});

describe("createBondGridApi", () => {
  it("asks the server for the requested window and returns it untouched", async () => {
    const rows = await createBondGridApi().fetchRows({ ...wholeList, offset: 20, limit: 5 });

    expect(vi.mocked(fetchValuations).mock.calls[0][0]).toMatchObject({ offset: 20, limit: 5 });
    expect(rows).toBe(sample);
  });

  it("passes the sort to the server rather than reordering the slice", async () => {
    const sort = { field: "conversionValue", direction: "desc", nulls: "last" } as const;

    const rows = await createBondGridApi().fetchRows({ ...wholeList, sort });

    expect(vi.mocked(fetchValuations).mock.calls[0][0]).toMatchObject({ sort });
    // Source order, untouched: re-sorting here would fight the server's order
    // and make rows swap under a still viewport.
    expect(rows.map((r) => r.symbol)).toEqual(["B", "A"]);
  });

  it("sends no sort parameters when the user has sorted nothing", async () => {
    await createBondGridApi().fetchRows(wholeList);

    expect(vi.mocked(fetchValuations).mock.calls[0][0].sort).toBeNull();
  });

  it("forwards the slice's abort signal", async () => {
    const controller = new AbortController();

    await createBondGridApi().fetchRows({ ...wholeList, signal: controller.signal });

    expect(vi.mocked(fetchValuations).mock.calls[0][0].signal).toBe(controller.signal);
  });

  it("takes the total from the count endpoint, never from a row list", async () => {
    vi.mocked(fetchValuationCount).mockResolvedValue(412);

    const total = await createBondGridApi().fetchCount({ collapsedGroups: [] });

    expect(total).toBe(412);
    expect(vi.mocked(fetchValuations)).not.toHaveBeenCalled();
  });

  it("resolves one row by symbol, without scanning a list", async () => {
    const row = await createBondGridApi().fetchRow("B");

    expect(vi.mocked(fetchValuation).mock.calls[0][0]).toBe("B");
    expect(row).toBe(sample[0]);
    expect(vi.mocked(fetchValuations)).not.toHaveBeenCalled();
  });

  it("reports a missing symbol as null", async () => {
    vi.mocked(fetchValuation).mockResolvedValue(null);

    expect(await createBondGridApi().fetchRow("gone")).toBeNull();
  });

  it("updateRow is a no-op returning ok:false (read-only)", async () => {
    const api = createBondGridApi();
    expect(await api.updateRow({ id: "B", changes: { symbol: "X" } })).toEqual({ ok: false });
  });
});

describe("bondGrid instance", () => {
  it("injects itself into the root reducer on import, with no wiring in app/", () => {
    const state = rootReducer(undefined, { type: "@@init" });
    expect(bondGrid.selectRoot(state).columns.order).toEqual(
      bondGrid.descriptor.columns.defaultOrder,
    );
    expect(GRID_NAME).toBe(bondGrid.descriptor.name);
  });

  it("reduces client-owned state only — no rows in the store", () => {
    const store = configureStore({
      reducer: { [bondGrid.descriptor.name]: bondGrid.reducer },
      middleware: (getDefault) =>
        getDefault({ serializableCheck: false }).concat(appListener.middleware),
    });
    expect(Object.keys(bondGrid.selectRoot(store.getState())).sort()).toEqual([
      "columns",
      "edits",
      "groups",
      "selection",
    ]);
  });

  it("starts with an empty store cell, and loads every window from the server", async () => {
    expect(bondGrid.storeRef.current).toBeNull();

    const rows = await bondGrid.descriptor.api.fetchRows({
      offset: 0,
      limit: 2,
      sort: null,
      collapsedGroups: [],
    });
    expect(await bondGrid.descriptor.api.fetchCount({ collapsedGroups: [] })).toBe(3);
    expect(rows.map((r) => r.symbol)).toEqual(["B", "A"]);
  });

  it("asks once per window, each carrying its own offset", async () => {
    await Promise.all(
      [0, 1, 2].map((offset) =>
        bondGrid.descriptor.api.fetchRows({ offset, limit: 1, sort: null, collapsedGroups: [] }),
      ),
    );

    expect(vi.mocked(fetchValuations).mock.calls.map((c) => c[0].offset)).toEqual([0, 1, 2]);
  });
});
