import { describe, it, expect } from "vitest";
import { mapValuations } from "./mapValuations";
import type { ConversionValuationWire } from "../types";

describe("mapValuations", () => {
  it("maps a fully-populated wire record to numbers", () => {
    const wire: ConversionValuationWire[] = [
      {
        symbol: "11011",
        conversionShares: 2000,
        conversionValue: 120000,
        stockPrice: 60,
        asOf: "2026-07-02",
        bondPrice: 100000,
        isInTheMoney: true,
      },
    ];

    const [v] = mapValuations(wire);

    expect(v).toEqual({
      symbol: "11011",
      conversionShares: 2000,
      conversionValue: 120000,
      stockPrice: 60,
      asOf: "2026-07-02",
      bondPrice: 100000,
      isInTheMoney: true,
    });
  });

  it("coerces string-encoded numbers", () => {
    const wire: ConversionValuationWire[] = [
      {
        symbol: "11011",
        conversionShares: "2000",
        conversionValue: "120000",
        stockPrice: "60",
        asOf: "2026-07-02",
        bondPrice: "100000",
        isInTheMoney: false,
      },
    ];

    const [v] = mapValuations(wire);

    expect(v.conversionValue).toBe(120000);
    expect(v.bondPrice).toBe(100000);
    expect(typeof v.conversionValue).toBe("number");
  });

  it("preserves null bondPrice and isInTheMoney without coercing to a number or false", () => {
    const wire: ConversionValuationWire[] = [
      {
        symbol: "11011",
        conversionShares: 2000,
        conversionValue: 120000,
        stockPrice: 60,
        asOf: "2026-07-02",
        bondPrice: null,
        isInTheMoney: null,
      },
    ];

    const [v] = mapValuations(wire);

    expect(v.bondPrice).toBeNull();
    expect(v.isInTheMoney).toBeNull();
  });
});
