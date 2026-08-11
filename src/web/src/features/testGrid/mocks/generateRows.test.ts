import { describe, expect, it } from "vitest";
import { SECTORS } from "../api/types";
import { DEFAULT_SEED, generateRows } from "./generateRows";

describe("generateRows", () => {
  it("returns the requested number of rows", () => {
    expect(generateRows(1_000)).toHaveLength(1_000);
  });

  it("is deterministic: the same seed gives the same rows", () => {
    expect(generateRows(200, 42)).toEqual(generateRows(200, 42));
  });

  it("is seeded: a different seed gives different rows", () => {
    const a = generateRows(200, 1);
    const b = generateRows(200, 2);

    expect(a.map((r) => r.price)).not.toEqual(b.map((r) => r.price));
  });

  it("numbers the ids from 1 with no gaps", () => {
    const rows = generateRows(50);

    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it("uses every sector and assigns ids in sector order", () => {
    const rows = generateRows(1_200);
    const indexes = rows.map((r) => SECTORS.indexOf(r.sector as (typeof SECTORS)[number]));

    expect(new Set(indexes).size).toBe(SECTORS.length);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    expect(indexes).not.toContain(-1);
  });

  it("spreads the rows over the sectors evenly, within one row", () => {
    const rows = generateRows(1_200);
    const sizes = SECTORS.map((s) => rows.filter((r) => r.sector === s).length);

    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("computes value from quantity and price", () => {
    for (const row of generateRows(100)) {
      expect(row.value).toBeCloseTo(row.quantity * row.price, 6);
    }
  });

  it("produces an E.164 contact and an ISO date", () => {
    for (const row of generateRows(100)) {
      expect(row.contact).toMatch(/^\+1\d{10}$/);
      expect(row.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("exposes the default seed it uses when none is given", () => {
    expect(generateRows(10)).toEqual(generateRows(10, DEFAULT_SEED));
  });
});
