import { describe, expect, it } from "vitest";
import { SECTORS } from "../api/types";
import { createTestRowStore } from "./testRowStore";

/** 120 rows over 12 sectors is 10 rows per sector — small and exactly even. */
const COUNT = 120;
const PER_SECTOR = COUNT / SECTORS.length;

function store() {
  return createTestRowStore(COUNT);
}

describe("testRowStore", () => {
  it("counts every row when nothing is collapsed", () => {
    expect(store().count([])).toBe(COUNT);
  });

  it("slices the requested range", () => {
    const rows = store().slice({ offset: 10, limit: 5, sort: null, collapsed: [] });

    expect(rows.map((r) => r.id)).toEqual([11, 12, 13, 14, 15]);
  });

  it("orders by sector before the requested sort", () => {
    const rows = store().slice({
      offset: 0,
      limit: COUNT,
      sort: { field: "price", direction: "asc", nulls: "last" },
      collapsed: [],
    });

    const sectorIndexes = rows.map((r) => SECTORS.indexOf(r.sector as (typeof SECTORS)[number]));
    expect(sectorIndexes).toEqual([...sectorIndexes].sort((a, b) => a - b));

    const firstSector = rows.slice(0, PER_SECTOR);
    expect(firstSector.map((r) => r.price)).toEqual(
      [...firstSector.map((r) => r.price)].sort((a, b) => a - b),
    );
  });

  it("excludes a collapsed sector from the count", () => {
    expect(store().count([SECTORS[0]])).toBe(COUNT - PER_SECTOR);
  });

  it("excludes a collapsed sector from a slice", () => {
    const rows = store().slice({
      offset: 0,
      limit: COUNT,
      sort: null,
      collapsed: [SECTORS[0]],
    });

    expect(rows).toHaveLength(COUNT - PER_SECTOR);
    expect(rows.some((r) => r.sector === SECTORS[0])).toBe(false);
  });

  it("finds one row by id, and answers undefined for an unknown id", () => {
    expect(store().find(3)?.id).toBe(3);
    expect(store().find(9_999)).toBeUndefined();
  });

  it("applies an update and recomputes value", () => {
    const s = store();
    const before = s.find(4)!;

    const after = s.update(4, { quantity: before.quantity + 10 })!;

    expect(after.quantity).toBe(before.quantity + 10);
    expect(after.value).toBeCloseTo(after.quantity * after.price, 6);
  });

  it("keeps an update, so a later read sees it", () => {
    const s = store();
    s.update(4, { name: "Edited" });

    expect(s.find(4)?.name).toBe("Edited");
    expect(s.slice({ offset: 3, limit: 1, sort: null, collapsed: [] })[0].name).toBe("Edited");
  });

  it("stamps updatedAt only when the change does not name it", () => {
    const s = store();

    const stamped = s.update(5, { quantity: 1 })!;
    expect(stamped.updatedAt).toBe(new Date().toISOString().slice(0, 10));

    const explicit = s.update(6, { updatedAt: "2020-02-02" })!;
    expect(explicit.updatedAt).toBe("2020-02-02");
  });

  it("answers undefined when the updated row does not exist", () => {
    expect(store().update(9_999, { name: "x" })).toBeUndefined();
  });

  it("re-orders after an edit that moves a row inside its sector", () => {
    const s = store();
    const sorted = { offset: 0, limit: PER_SECTOR, sort: null, collapsed: [] };

    const byPrice = {
      ...sorted,
      sort: { field: "price", direction: "asc", nulls: "last" } as const,
    };

    const firstBefore = s.slice(byPrice)[0];
    s.update(firstBefore.id, { price: 100_000 });

    expect(s.slice(byPrice)[0].id).not.toBe(firstBefore.id);
  });

  it("drops every edit on reset", () => {
    const s = store();
    const original = s.find(4)!.name;

    s.update(4, { name: "Edited" });
    expect(s.reset()).toBe(COUNT);

    expect(s.find(4)?.name).toBe(original);
  });
});
