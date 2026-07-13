import type { ConversionValuation } from "../types";

/**
 * Transport-agnostic access to convertible-bond valuations. Implemented over the
 * MAUI HybridWebView bridge now, and (later) over an HTTP API — callers depend on
 * this interface, never on a concrete transport.
 */
export interface BondDataSource {
  /**
   * Returns today's conversion valuation for every cached convertible bond.
   */
  getValuations(): Promise<ConversionValuation[]>;
}
