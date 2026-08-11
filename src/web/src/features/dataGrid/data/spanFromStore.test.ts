import { describe, expect, it } from "vitest";
import { createRowStore } from "./rowStore";
import { spanFromStore } from "./spanFromStore";

interface Row {
  id: number;
  g: number;
}

const rowKey = (r: Row) => r.id;

const grouping = {
  field: "g",
  of: (r: Row) => r.g,
  order: (g: number) => g,
  label: String,
};

/** Rows 0-9 are group 0, 10-19 group 1, and so on. */
function page(start: number, count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: start + i,
    g: Math.floor((start + i) / 10),
  }));
}

describe("spanFromStore", () => {
  it("reads the whole window when the store holds it", () => {
    const store = createRowStore<Row, number>(100, rowKey);
    store.writePage(0, page(0, 100));

    const span = spanFromStore(store, 0, 100, undefined);

    expect(span.offset).toBe(0);
    expect(span.rows).toHaveLength(100);
    expect(span.rows[0].id).toBe(0);
  });

  it("stops at the first hole rather than reporting rows across it", () => {
    const store = createRowStore<Row, number>(100, rowKey);
    store.writePage(0, page(0, 100));

    // Page 1 is missing, so the run ends at index 99.
    const span = spanFromStore(store, 0, 300, undefined);

    expect(span.rows).toHaveLength(100);
    expect(span.rows.at(-1)?.id).toBe(99);
  });

  it("answers with an empty run when the window's first row is missing", () => {
    const store = createRowStore<Row, number>(100, rowKey);
    store.writePage(1, page(100, 100));

    const span = spanFromStore(store, 0, 100, undefined);

    expect(span.rows).toEqual([]);
    expect(span.offset).toBe(0);
  });

  it("reads the group of the row directly above the window", () => {
    const store = createRowStore<Row, number>(100, rowKey);
    store.writePage(0, page(0, 100));

    const span = spanFromStore(store, 50, 20, grouping);

    expect(span.offset).toBe(50);
    expect(span.rows[0].id).toBe(50);
    expect(span.precedingGroupKey).toBe(4);
  });

  it("reports no preceding group at row 0, because no row precedes it", () => {
    const store = createRowStore<Row, number>(100, rowKey);
    store.writePage(0, page(0, 100));

    const span = spanFromStore(store, 0, 20, grouping);

    expect(span.precedingGroupKey).toBeNull();
  });

  it("reports no preceding group when the store does not hold that row", () => {
    const store = createRowStore<Row, number>(100, rowKey);
    store.writePage(1, page(100, 100));

    const span = spanFromStore(store, 100, 20, grouping);

    expect(span.rows[0].id).toBe(100);
    expect(span.precedingGroupKey).toBeNull();
  });

  it("reports no preceding group for a grid with no grouping", () => {
    const store = createRowStore<Row, number>(100, rowKey);
    store.writePage(0, page(0, 100));

    const span = spanFromStore(store, 50, 20, undefined);

    expect(span.precedingGroupKey).toBeNull();
  });
});
