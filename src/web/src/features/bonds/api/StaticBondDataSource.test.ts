import { describe, expect, it } from "vitest";
import { StaticBondDataSource } from "./StaticBondDataSource";

describe("StaticBondDataSource", () => {
  it("returns a non-empty list of valuations", async () => {
    const rows = await new StaticBondDataSource().getValuations();
    expect(rows.length).toBeGreaterThan(0);
  });

  it("includes a no-quote row with null bondPrice and null isInTheMoney", async () => {
    const rows = await new StaticBondDataSource().getValuations();
    const noQuote = rows.filter((r) => r.bondPrice === null);
    expect(noQuote.length).toBeGreaterThan(0);
    expect(noQuote.every((r) => r.isInTheMoney === null)).toBe(true);
  });

  it("includes both in-the-money and out-of-the-money rows", async () => {
    const rows = await new StaticBondDataSource().getValuations();
    expect(rows.some((r) => r.isInTheMoney === true)).toBe(true);
    expect(rows.some((r) => r.isInTheMoney === false)).toBe(true);
  });
});
