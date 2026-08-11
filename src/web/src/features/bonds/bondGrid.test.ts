import { configureStore } from "@reduxjs/toolkit";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rootReducer } from "../../app/rootReducer";
import { appListener } from "../../app/listener";
import { queryClient } from "../../app/queryClient";
import { bondKeys } from "./api/bondQueries";
import { bondGrid, createBondGridApi, GRID_NAME } from "./bondGrid";
import type { ConversionValuation } from "./api/types";

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
  {
    symbol: "C",
    conversionShares: 3,
    conversionValue: 200,
    stockPrice: 2,
    asOf: "2026-07-17",
    bondPrice: 95,
    isInTheMoney: false,
  },
];

// Seeding the cache keeps these tests free of fetch stubbing. The transport has
// its own tests (src/lib/http); re-testing it here would couple grid behaviour
// to HTTP details.
function seededClient(rows: ConversionValuation[]): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(bondKeys.valuations(), rows);
  return client;
}

/** The whole list, unsorted — the collection's default ask. */
const wholeList = { offset: 0, limit: 10, sort: null, collapsedGroups: [] as never[] };

describe("createBondGridApi", () => {
  it("returns rows in source order and reports the total", async () => {
    const api = createBondGridApi(seededClient(sample));
    const rows = await api.fetchRows(wholeList);
    expect(await api.fetchCount()).toBe(3);
    expect(rows.map((r) => r.symbol)).toEqual(["B", "A", "C"]);
  });

  it("slices to the requested range", async () => {
    const api = createBondGridApi(seededClient(sample));
    const rows = await api.fetchRows({ ...wholeList, offset: 1, limit: 1 });
    expect(rows.map((r) => r.symbol)).toEqual(["A"]);
    expect(await api.fetchCount()).toBe(3);
  });

  it("sorts ascending by a numeric field", async () => {
    const rows = await createBondGridApi(seededClient(sample)).fetchRows({
      ...wholeList,
      sort: { field: "conversionValue", direction: "asc", nulls: "last" },
    });
    expect(rows.map((r) => r.conversionValue)).toEqual([100, 200, 300]);
    expect(rows.map((r) => r.symbol)).toEqual(["A", "C", "B"]);
  });

  it("sorts descending", async () => {
    const rows = await createBondGridApi(seededClient(sample)).fetchRows({
      ...wholeList,
      sort: { field: "conversionValue", direction: "desc", nulls: "last" },
    });
    expect(rows.map((r) => r.conversionValue)).toEqual([300, 200, 100]);
  });

  it("sorts null fields last regardless of direction", async () => {
    const rows = await createBondGridApi(seededClient(sample)).fetchRows({
      ...wholeList,
      sort: { field: "bondPrice", direction: "asc", nulls: "last" },
    });
    expect(rows.map((r) => r.bondPrice)).toEqual([95, 110, null]);
  });

  it("updateRow is a no-op returning ok:false (read-only)", async () => {
    const api = createBondGridApi(seededClient(sample));
    expect(await api.updateRow({ id: "B", changes: { symbol: "X" } })).toEqual({ ok: false });
  });

  it("does not mutate the cached list when sorting, so a later unsorted call returns source order", async () => {
    const api = createBondGridApi(seededClient(sample));
    await api.fetchRows({
      ...wholeList,
      sort: { field: "conversionValue", direction: "asc", nulls: "last" },
    });
    const rows = await api.fetchRows(wholeList);
    expect(rows.map((r) => r.symbol)).toEqual(["B", "A", "C"]);
  });
});

describe("bondGrid instance", () => {
  beforeEach(() => {
    // bondGridDescriptor is bound to the app-wide client at module scope, so
    // the store-level test seeds that client rather than a throwaway one.
    queryClient.setQueryData(bondKeys.valuations(), sample);
  });

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

  it("starts with an empty store cell, and loads through the app-wide cache", async () => {
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

  it("serves every slice from one whole-list request", async () => {
    // The endpoint is not paged: asking for many slices must not multiply the
    // network calls behind them.
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(sample), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    queryClient.clear();

    const slices = await Promise.all(
      [0, 1, 2].map((offset) =>
        bondGrid.descriptor.api.fetchRows({ offset, limit: 1, sort: null, collapsedGroups: [] }),
      ),
    );

    expect(slices.map((s) => s[0].symbol)).toEqual(["B", "A", "C"]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
