import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "./client";

declare global {
  // eslint-disable-next-line no-var
  var HybridWebView: { InvokeDotNet: (name: string, args?: unknown[]) => Promise<unknown> };
}

describe("invoke", () => {
  beforeEach(() => {
    globalThis.HybridWebView = { InvokeDotNet: vi.fn() };
  });

  it("calls InvokeDotNet with only the method name when no args are given", async () => {
    (globalThis.HybridWebView.InvokeDotNet as ReturnType<typeof vi.fn>).mockResolvedValue("ok");
    const result = await invoke<string>("Ping");
    expect(globalThis.HybridWebView.InvokeDotNet).toHaveBeenCalledWith("Ping");
    expect(result).toBe("ok");
  });

  it("forwards args to InvokeDotNet when provided", async () => {
    (globalThis.HybridWebView.InvokeDotNet as ReturnType<typeof vi.fn>).mockResolvedValue(42);
    const result = await invoke<number>("Add", [1, 2]);
    expect(globalThis.HybridWebView.InvokeDotNet).toHaveBeenCalledWith("Add", [1, 2]);
    expect(result).toBe(42);
  });
});
