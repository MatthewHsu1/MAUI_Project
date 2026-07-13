import type { ConversionValuation, ConversionValuationWire } from "../types";

/**
 * Maps raw bridge records to the domain type: coerces numeric fields to numbers
 * and preserves null `bondPrice` / `isInTheMoney`.
 */
export function mapValuations(wire: ConversionValuationWire[]): ConversionValuation[] {
  return wire.map((w) => ({
    symbol: w.symbol,
    conversionShares: Number(w.conversionShares),
    conversionValue: Number(w.conversionValue),
    stockPrice: Number(w.stockPrice),
    asOf: w.asOf,
    bondPrice: w.bondPrice === null ? null : Number(w.bondPrice),
    isInTheMoney: w.isInTheMoney,
  }));
}
