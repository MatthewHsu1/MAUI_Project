import { describe, expect, it } from "vitest";
import { compareBySpec, specFromGridSort, type SortSpec } from "./sortSpec";

interface Row {
  id: number;
  price: number | null;
  name: string;
}

const key = (r: Row) => r.id;
const spec = (over: Partial<SortSpec> = {}): SortSpec => ({
  field: "price",
  direction: "asc",
  nulls: "last",
  ...over,
});

describe("compareBySpec", () => {
  it("orders numbers ascending", () => {
    const a = { id: 1, price: 10, name: "a" };
    const b = { id: 2, price: 20, name: "b" };
    expect(compareBySpec(a, b, spec(), key)).toBeLessThan(0);
  });

  it("orders numbers descending", () => {
    const a = { id: 1, price: 10, name: "a" };
    const b = { id: 2, price: 20, name: "b" };
    expect(compareBySpec(a, b, spec({ direction: "desc" }), key)).toBeGreaterThan(0);
  });

  it("puts nulls last in both directions", () => {
    const a = { id: 1, price: null, name: "a" };
    const b = { id: 2, price: 20, name: "b" };
    expect(compareBySpec(a, b, spec(), key)).toBeGreaterThan(0);
    expect(compareBySpec(a, b, spec({ direction: "desc" }), key)).toBeGreaterThan(0);
  });

  it("breaks ties on the row key, so equal values never swap", () => {
    const a = { id: 7, price: 5, name: "a" };
    const b = { id: 3, price: 5, name: "b" };
    expect(compareBySpec(a, b, spec(), key)).toBeGreaterThan(0);
    expect(compareBySpec(b, a, spec(), key)).toBeLessThan(0);
  });

  it("breaks ties the same way whatever the direction", () => {
    const a = { id: 7, price: 5, name: "a" };
    const b = { id: 3, price: 5, name: "b" };
    expect(compareBySpec(a, b, spec({ direction: "desc" }), key)).toBeGreaterThan(0);
  });

  it("compares strings with localeCompare", () => {
    const a = { id: 1, price: 0, name: "apple" };
    const b = { id: 2, price: 0, name: "banana" };
    expect(compareBySpec(a, b, spec({ field: "name" }), key)).toBeLessThan(0);
  });
});

describe("specFromGridSort", () => {
  it("returns null when nothing is sorted", () => {
    expect(specFromGridSort(null)).toBeNull();
  });

  it("carries the field and direction, and always puts nulls last", () => {
    expect(specFromGridSort({ field: "price", dir: "desc" })).toEqual({
      field: "price",
      direction: "desc",
      nulls: "last",
    });
  });
});
