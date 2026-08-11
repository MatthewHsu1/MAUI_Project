import { describe, expect, it } from "vitest";
import { carryPagesBefore, createRowStore } from "./rowStore";

interface Row {
  id: number;
  name: string;
}

const rowKey = (r: Row) => r.id;

function page(start: number, count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: start + i, name: `row-${start + i}` }));
}

describe("createRowStore", () => {
  it("serves a written page by absolute row index", () => {
    const store = createRowStore<Row, number>(100, rowKey);

    store.writePage(3, page(300, 100));

    expect(store.getRow(300)?.name).toBe("row-300");
    expect(store.getRow(399)?.name).toBe("row-399");
    expect(store.getRow(299)).toBeUndefined();
  });

  it("reports which absolute indexes a write touched, for the damage list", () => {
    const store = createRowStore<Row, number>(100, rowKey);

    const written = store.writePage(2, page(200, 3));

    expect(written).toEqual([200, 201, 202]);
  });

  it("tracks page state through a load", () => {
    const store = createRowStore<Row, number>(100, rowKey);

    expect(store.pageState(0)).toBe("missing");

    store.markLoading(0);
    expect(store.pageState(0)).toBe("loading");

    store.writePage(0, page(0, 100));
    expect(store.pageState(0)).toBe("loaded");
  });

  it("keeps a failed page distinguishable from one nobody asked for", () => {
    const store = createRowStore<Row, number>(100, rowKey);

    store.markLoading(4);
    store.markFailed(4);

    expect(store.pageState(4)).toBe("failed");
    expect(store.getRow(400)).toBeUndefined();
  });

  it("finds a row's index by its key, so a push can damage it", () => {
    const store = createRowStore<Row, number>(100, rowKey);

    store.writePage(1, page(100, 100));

    expect(store.indexOfKey(150)).toBe(150);
    expect(store.indexOfKey(9_999)).toBeUndefined();
  });

  it("patches one row in place and reports where it sits", () => {
    const store = createRowStore<Row, number>(100, rowKey);

    store.writePage(0, page(0, 100));

    const index = store.patchRow(7, { name: "patched" });

    expect(index).toBe(7);
    expect(store.getRow(7)?.name).toBe("patched");
  });

  it("answers undefined when a patch names a row it does not hold", () => {
    const store = createRowStore<Row, number>(100, rowKey);

    expect(store.patchRow(7, { name: "patched" })).toBeUndefined();
  });

  it("evicts the page furthest from the one just written", () => {
    const store = createRowStore<Row, number>(100, rowKey, 2);

    store.writePage(0, page(0, 100));
    store.writePage(1, page(100, 100));

    // Page 0 is 10 pages from the write; page 1 is 9. The further one goes.
    store.writePage(10, page(1_000, 100));

    expect(store.getRow(0)).toBeUndefined();
    expect(store.pageState(0)).toBe("missing");
    expect(store.getRow(100)?.name).toBe("row-100");
    expect(store.getRow(1_000)?.name).toBe("row-1000");
  });

  it("keeps the pages nearest the write when the user scrolls back", () => {
    const store = createRowStore<Row, number>(100, rowKey, 2);

    store.writePage(10, page(1_000, 100));
    store.writePage(11, page(1_100, 100));

    // Back to the top. Page 11 is the furthest from page 0, so it goes and
    // page 10 stays — the one the user would meet first on the way back down.
    store.writePage(0, page(0, 100));

    expect(store.getRow(1_100)).toBeUndefined();
    expect(store.getRow(1_000)?.name).toBe("row-1000");
    expect(store.getRow(0)?.name).toBe("row-0");
  });

  it("never evicts the page it just wrote", () => {
    const store = createRowStore<Row, number>(100, rowKey, 1);

    store.writePage(50, page(5_000, 100));
    store.writePage(0, page(0, 100));

    expect(store.getRow(0)?.name).toBe("row-0");
    expect(store.getRow(5_000)).toBeUndefined();
  });

  it("forgets an evicted page's keys, so indexOfKey cannot name a dropped row", () => {
    const store = createRowStore<Row, number>(100, rowKey, 1);

    store.writePage(0, page(0, 100));
    store.writePage(1, page(100, 100));

    expect(store.indexOfKey(5)).toBeUndefined();
    expect(store.indexOfKey(105)).toBe(105);
  });

  it("puts a failed page back to missing so it can be retried", () => {
    const store = createRowStore<Row, number>(100, rowKey);

    store.markFailed(2);
    store.markMissing(2);

    expect(store.pageState(2)).toBe("missing");
  });

  it("accepts a short final page without claiming the rows beyond it", () => {
    const store = createRowStore<Row, number>(100, rowKey);

    store.writePage(9, page(900, 12));

    expect(store.getRow(911)?.name).toBe("row-911");
    expect(store.getRow(912)).toBeUndefined();
    expect(store.pageState(9)).toBe("loaded");
  });
});

describe("carryPagesBefore", () => {
  it("lists the pages it holds, in order", () => {
    const store = createRowStore<Row, number>(10, rowKey);

    store.writePage(3, page(30, 10));
    store.writePage(1, page(10, 10));

    expect(store.loadedPages()).toEqual([1, 3]);
  });

  it("hands back the rows of a loaded page, and nothing for a missing one", () => {
    const store = createRowStore<Row, number>(10, rowKey);

    store.writePage(2, page(20, 10));

    expect(store.pageRows(2)?.[0].id).toBe(20);
    expect(store.pageRows(5)).toBeUndefined();
  });

  it("carries only the pages that end above the boundary", () => {
    const source = createRowStore<Row, number>(10, rowKey);
    const target = createRowStore<Row, number>(10, rowKey);

    [0, 1, 2, 3].forEach((p) => source.writePage(p, page(p * 10, 10)));

    // The boundary sits at index 25, inside page 2.
    const carried = carryPagesBefore(source, target, 25);

    expect(carried).toBe(2);
    expect(target.loadedPages()).toEqual([0, 1]);
    expect(target.getRow(19)?.id).toBe(19);
  });

  it("leaves the straddling page behind, because a store cannot split one", () => {
    const source = createRowStore<Row, number>(10, rowKey);
    const target = createRowStore<Row, number>(10, rowKey);

    source.writePage(2, page(20, 10));

    carryPagesBefore(source, target, 25);

    expect(target.pageState(2)).toBe("missing");
  });

  it("carries the key map with the rows, so a push can still find them", () => {
    const source = createRowStore<Row, number>(10, rowKey);
    const target = createRowStore<Row, number>(10, rowKey);

    source.writePage(0, page(0, 10));

    carryPagesBefore(source, target, 100);

    expect(target.indexOfKey(7)).toBe(7);
  });

  it("carries nothing at all when the boundary is the top of the table", () => {
    const source = createRowStore<Row, number>(10, rowKey);
    const target = createRowStore<Row, number>(10, rowKey);

    [0, 1, 2].forEach((p) => source.writePage(p, page(p * 10, 10)));

    expect(carryPagesBefore(source, target, 0)).toBe(0);
    expect(target.loadedPages()).toEqual([]);
  });

  it("keeps the pages nearest the boundary when it carries past the cap", () => {
    const source = createRowStore<Row, number>(10, rowKey);
    const target = createRowStore<Row, number>(10, rowKey, 2);

    [0, 1, 2, 3].forEach((p) => source.writePage(p, page(p * 10, 10)));

    // Every page ends above index 0 and below index 40, so all four are
    // eligible and the target can hold two of them.
    expect(carryPagesBefore(source, target, 40)).toBe(4);
    expect(target.loadedPages()).toEqual([2, 3]);
  });
});
