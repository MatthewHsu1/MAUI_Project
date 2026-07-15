import type { BondDataSource } from "./BondDataSource";
import { HybridBridgeSource } from "./HybridBridgeSource";

/**
 * Selects the live transport. Uses the HybridWebView bridge when running inside
 * the MAUI host; the HTTP API source is not built yet.
 */
export function createBondDataSource(): BondDataSource {
  const hasBridge = typeof (globalThis as { HybridWebView?: unknown }).HybridWebView !== "undefined";

  if (hasBridge) {
    return new HybridBridgeSource();
  }

  throw new Error("HTTP bond data source is not implemented yet.");
}
