import { describe, it, expect, vi, beforeEach } from "vitest";
import { HybridBridgeSource } from "./HybridBridgeSource";

declare global {
  // eslint-disable-next-line no-var
  var HybridWebView: { InvokeDotNet: (name: string, args?: unknown[]) => Promise<unknown> };
}

describe("HybridBridgeSource", () => {
  beforeEach(() => {
    globalThis.HybridWebView = { InvokeDotNet: vi.fn() };
  });

  it("invokes GetValuations and maps the result to the domain type", async () => {
    (globalThis.HybridWebView.InvokeDotNet as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        symbol: "11011",
        conversionShares: 2000,
        conversionValue: 120000,
        stockPrice: 60,
        asOf: "2026-07-02",
        bondPrice: null,
        isInTheMoney: null,
      },
    ]);

    const result = await new HybridBridgeSource().getValuations();

    expect(globalThis.HybridWebView.InvokeDotNet).toHaveBeenCalledWith("GetValuations");
    expect(result).toEqual([
      {
        symbol: "11011",
        conversionShares: 2000,
        conversionValue: 120000,
        stockPrice: 60,
        asOf: "2026-07-02",
        bondPrice: null,
        isInTheMoney: null,
      },
    ]);
  });
});
