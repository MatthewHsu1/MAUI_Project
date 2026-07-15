/**
 * A convertible bond's conversion valuation, as consumed by the UI.
 * `bondPrice` / `isInTheMoney` are null when no bond quote was available —
 * render "—", never a false "out-of-the-money".
 */
export interface ConversionValuation {
  symbol: string;
  conversionShares: number;
  conversionValue: number; // NT$
  stockPrice: number;
  asOf: string; // ISO date, "YYYY-MM-DD"
  bondPrice: number | null;
  isInTheMoney: boolean | null;
}

/**
 * Raw record shape as it arrives over the HybridWebView bridge (camelCased C#
 * DTO). Numeric fields are typed loosely to guard against string-encoded
 * decimals from any transport.
 */
export interface ConversionValuationWire {
  symbol: string;
  conversionShares: number | string;
  conversionValue: number | string;
  stockPrice: number | string;
  asOf: string;
  bondPrice: number | string | null;
  isInTheMoney: boolean | null;
}
