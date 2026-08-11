import { describe, it, expect } from "vitest";
import type { components } from "./schema.gen";

type Valuation = components["schemas"]["ConversionValuationDto"];

describe("generated API schema", () => {
  it("types a valuation with nullable bondPrice and isInTheMoney", () => {
    const sample: Valuation = {
      symbol: "12345",
      conversionShares: 1000,
      conversionValue: 50000,
      stockPrice: 50,
      asOf: "2026-07-21",
      bondPrice: null,
      isInTheMoney: null,
    };

    expect(sample.symbol).toBe("12345");
    expect(sample.bondPrice).toBeNull();
  });

  it("types a valuation with a populated bond quote", () => {
    const sample: Valuation = {
      symbol: "12345",
      conversionShares: 1000,
      conversionValue: 50000,
      stockPrice: 50,
      asOf: "2026-07-21",
      bondPrice: 102.5,
      isInTheMoney: true,
    };

    expect(sample.bondPrice).toBe(102.5);
    expect(sample.isInTheMoney).toBe(true);
  });
});
