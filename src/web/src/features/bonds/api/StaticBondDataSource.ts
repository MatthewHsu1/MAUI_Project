import type { BondDataSource } from "./BondDataSource";
import type { ConversionValuation } from "../types";

/**
 * Temporary hardcoded valuations, served in both dev and the MAUI host until the
 * HTTPS API exists. Deliberately covers the UI edge cases: in-the-money,
 * out-of-the-money, and a no-quote row (null bondPrice / isInTheMoney).
 */
export const STATIC_BOND_VALUATIONS: ConversionValuation[] = [
  {
    symbol: "15116",
    conversionShares: 2000,
    conversionValue: 130000,
    stockPrice: 65,
    asOf: "2026-07-17",
    bondPrice: 128.5,
    isInTheMoney: true,
  },
  {
    symbol: "23481",
    conversionShares: 1500,
    conversionValue: 90000,
    stockPrice: 60,
    asOf: "2026-07-17",
    bondPrice: 96.0,
    isInTheMoney: false,
  },
  {
    symbol: "26895",
    conversionShares: 2500,
    conversionValue: 175000,
    stockPrice: 70,
    asOf: "2026-07-17",
    bondPrice: 132.0,
    isInTheMoney: true,
  },
  {
    symbol: "45632",
    conversionShares: 1000,
    conversionValue: 48000,
    stockPrice: 48,
    asOf: "2026-07-17",
    bondPrice: 99.5,
    isInTheMoney: false,
  },
  {
    symbol: "91234",
    conversionShares: 1800,
    conversionValue: 99000,
    stockPrice: 55,
    asOf: "2026-07-17",
    bondPrice: null,
    isInTheMoney: null,
  },
  {
    symbol: "58012",
    conversionShares: 3000,
    conversionValue: 210000,
    stockPrice: 70,
    asOf: "2026-07-16",
    bondPrice: 140.0,
    isInTheMoney: true,
  },
];

/**
 * {@link BondDataSource} backed by a hardcoded list. See {@link STATIC_BOND_VALUATIONS}.
 */
export class StaticBondDataSource implements BondDataSource {
  getValuations(): Promise<ConversionValuation[]> {
    return Promise.resolve(STATIC_BOND_VALUATIONS);
  }
}
