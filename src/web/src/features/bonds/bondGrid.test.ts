import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";
import { rootReducer } from "../../app/rootReducer";
import { appListener } from "../../app/listener";
import type { BondDataSource } from "./api/BondDataSource";
import { bondGrid, createBondGridApi, GRID_NAME } from "./bondGrid";
import type { ConversionValuation } from "./types";

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

const fakeSource = (rows: ConversionValuation[]): BondDataSource => ({
  getValuations: () => Promise.resolve(rows),
});

describe("createBondGridApi", () => {
  it("assigns stable numeric ids by source order and reports the total", async () => {
    const res = await createBondGridApi(fakeSource(sample)).fetchWindow({
      skip: 0,
      take: 10,
      collapsedGroups: [],
    });
    expect(res.total).toBe(3);
    expect(res.precedingGroupKey).toBeNull();
    expect(res.rows.map((r) => r.id)).toEqual([0, 1, 2]);
    expect(res.rows.map((r) => r.symbol)).toEqual(["B", "A", "C"]);
  });

  it("slices to the requested window", async () => {
    const res = await createBondGridApi(fakeSource(sample)).fetchWindow({
      skip: 1,
      take: 1,
      collapsedGroups: [],
    });
    expect(res.rows.map((r) => r.symbol)).toEqual(["A"]);
    expect(res.total).toBe(3);
  });

  it("sorts ascending by a numeric field, keeping ids attached", async () => {
    const res = await createBondGridApi(fakeSource(sample)).fetchWindow({
      skip: 0,
      take: 10,
      collapsedGroups: [],
      sort: { field: "conversionValue", dir: "asc" },
    });
    expect(res.rows.map((r) => r.conversionValue)).toEqual([100, 200, 300]);
    expect(res.rows.map((r) => r.id)).toEqual([1, 2, 0]);
  });

  it("sorts descending", async () => {
    const res = await createBondGridApi(fakeSource(sample)).fetchWindow({
      skip: 0,
      take: 10,
      collapsedGroups: [],
      sort: { field: "conversionValue", dir: "desc" },
    });
    expect(res.rows.map((r) => r.conversionValue)).toEqual([300, 200, 100]);
  });

  it("sorts null fields last regardless of direction", async () => {
    const res = await createBondGridApi(fakeSource(sample)).fetchWindow({
      skip: 0,
      take: 10,
      collapsedGroups: [],
      sort: { field: "bondPrice", dir: "asc" },
    });
    expect(res.rows.map((r) => r.bondPrice)).toEqual([95, 110, null]);
  });

  it("updateRow is a no-op returning ok:false (read-only)", async () => {
    const api = createBondGridApi(fakeSource(sample));
    expect(await api.updateRow({ id: 0, field: "symbol", value: "X" })).toEqual({ ok: false });
  });

  it("does not mutate the cached list when sorting, so a later unsorted call returns source order", async () => {
    const api = createBondGridApi(fakeSource(sample));
    await api.fetchWindow({
      skip: 0,
      take: 10,
      collapsedGroups: [],
      sort: { field: "conversionValue", dir: "asc" },
    });
    const res = await api.fetchWindow({ skip: 0, take: 10, collapsedGroups: [] });
    expect(res.rows.map((r) => r.symbol)).toEqual(["B", "A", "C"]);
    expect(res.rows.map((r) => r.id)).toEqual([0, 1, 2]);
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

  it("populates total and rows through the store via the static source", async () => {
    const store = configureStore({
      reducer: { [bondGrid.descriptor.name]: bondGrid.reducer },
      middleware: (getDefault) =>
        getDefault({ serializableCheck: false }).concat(appListener.middleware),
    });
    await store.dispatch(bondGrid.thunks.fetchWindow({ skip: 0, take: 100 }));
    const state = bondGrid.selectRoot(store.getState());
    expect(state.gridData.total).toBeGreaterThan(0);
    expect(state.gridData.byIndex[0]).toBeDefined();
  });
});
