import type { BondDataSource } from "./BondDataSource";
import { StaticBondDataSource } from "./StaticBondDataSource";

/**
 * Selects the bond data transport.
 *
 * TODO: replace with an HttpBondDataSource (used by BOTH dev and prod) once the
 * HTTPS valuation API is available. Until then a hardcoded static list is served
 * everywhere so the grid UI can be built and previewed without the MAUI host.
 * The HybridWebView bridge source ({@link ./HybridBridgeSource}) stays in the
 * tree for reference but is not selected here.
 */
export function createBondDataSource(): BondDataSource {
  return new StaticBondDataSource();
}
