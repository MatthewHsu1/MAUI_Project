import { invoke } from "../../../bridge/client";
import type { BondDataSource } from "./BondDataSource";
import { mapValuations } from "./mapValuations";
import type { ConversionValuation, ConversionValuationWire } from "../types";

/**
 * {@link BondDataSource} implemented over the MAUI HybridWebView bridge.
 */
export class HybridBridgeSource implements BondDataSource {
  async getValuations(): Promise<ConversionValuation[]> {
    const wire = await invoke<ConversionValuationWire[]>("GetValuations");
    return mapValuations(wire);
  }
}
