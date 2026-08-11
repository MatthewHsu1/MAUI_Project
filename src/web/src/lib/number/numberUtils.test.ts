import { describe, expect, it } from "vitest";
import {
  currencySymbol,
  formatNumberDisplay,
  isValueInRange,
  parseNumberPaste,
  resolveNumberFormat,
} from "./numberUtils";

describe("resolveNumberFormat", () => {
  it("currency: $ prefix, 2 fixed decimals, grouped", () => {
    const r = resolveNumberFormat({ format: "currency", currency: "USD" });
    expect(r.prefix).toBe("$");
    expect(r.decimalScale).toBe(2);
    expect(r.fixedDecimalScale).toBe(true);
    expect(r.thousandSeparator).toBe(true);
  });

  it("integer: 0 decimals, no grouping by default", () => {
    const r = resolveNumberFormat({ format: "integer" });
    expect(r.decimalScale).toBe(0);
    expect(r.thousandSeparator).toBe(false);
    expect(r.prefix).toBeUndefined();
  });

  it("decimal (default): free decimals, no grouping", () => {
    const r = resolveNumberFormat({});
    expect(r.decimalScale).toBeUndefined();
    expect(r.thousandSeparator).toBe(false);
  });

  it("explicit options override format defaults", () => {
    const r = resolveNumberFormat({
      format: "currency",
      decimalScale: 0,
      thousandSeparator: false,
      prefix: "€",
    });
    expect(r.decimalScale).toBe(0);
    expect(r.thousandSeparator).toBe(false);
    expect(r.prefix).toBe("€");
  });

  it("allowNegative follows min", () => {
    expect(resolveNumberFormat({}).allowNegative).toBe(true);
    expect(resolveNumberFormat({ min: 0 }).allowNegative).toBe(false);
    expect(resolveNumberFormat({ min: -5 }).allowNegative).toBe(true);
  });

  it("isAllowed enforces [min, max] and permits empty", () => {
    const { isAllowed } = resolveNumberFormat({ min: 0, max: 100 });
    expect(isAllowed({ floatValue: 50 })).toBe(true);
    expect(isAllowed({ floatValue: -1 })).toBe(false);
    expect(isAllowed({ floatValue: 101 })).toBe(false);
    expect(isAllowed({ floatValue: undefined })).toBe(true);
  });
});

describe("currencySymbol", () => {
  it("returns the symbol for known currencies", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
  });

  it("falls back to $ for junk", () => {
    expect(currencySymbol("NOPE")).toBe("$");
  });
});

describe("isValueInRange", () => {
  it("checks inclusive bounds; null is in range", () => {
    expect(isValueInRange(5, 0, 10)).toBe(true);
    expect(isValueInRange(0, 0, 10)).toBe(true);
    expect(isValueInRange(-1, 0, 10)).toBe(false);
    expect(isValueInRange(11, 0, 10)).toBe(false);
    expect(isValueInRange(null, 0, 10)).toBe(true);
  });
});

describe("parseNumberPaste", () => {
  it("strips separators and currency symbols", () => {
    expect(parseNumberPaste("1,234.50", { nullable: false })).toBe(1234.5);
    expect(parseNumberPaste("$50", { nullable: false })).toBe(50);
  });

  it("rejects non-numbers", () => {
    expect(parseNumberPaste("abc", { nullable: false })).toBeUndefined();
  });

  it("empty is null when nullable, undefined otherwise", () => {
    expect(parseNumberPaste("   ", { nullable: true })).toBeNull();
    expect(parseNumberPaste("   ", { nullable: false })).toBeUndefined();
  });

  it("rejects out-of-range values", () => {
    expect(parseNumberPaste("500", { min: 0, max: 100, nullable: false })).toBeUndefined();
  });
});

describe("formatNumberDisplay", () => {
  it("formats currency, integer, and decimal", () => {
    expect(formatNumberDisplay(1234.5, { format: "currency", currency: "USD" })).toBe("$1,234.50");
    expect(formatNumberDisplay(1000, { format: "integer" })).toBe("1000");
    expect(formatNumberDisplay(1234.567, { format: "decimal" })).toBe("1234.567");
  });
});
