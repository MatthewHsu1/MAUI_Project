import { describe, it, expect, vi, beforeEach } from "vitest";
import { bridge } from "./client";
import type { UserDto } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var HybridWebView: { InvokeDotNet: (name: string, args?: unknown[]) => Promise<unknown> };
}

describe("bridge.users", () => {
  beforeEach(() => {
    globalThis.HybridWebView = { InvokeDotNet: vi.fn() };
  });

  it("getAll calls GetUsers and returns the result", async () => {
    const fake: UserDto[] = [{ id: "1", name: "Ada", email: "ada@x.com" }];
    (globalThis.HybridWebView.InvokeDotNet as ReturnType<typeof vi.fn>).mockResolvedValue(fake);

    const result = await bridge.users.getAll();

    expect(globalThis.HybridWebView.InvokeDotNet).toHaveBeenCalledWith("GetUsers");
    expect(result).toEqual(fake);
  });

  it("add calls AddUser with name and email", async () => {
    const created: UserDto = { id: "2", name: "Bob", email: "bob@x.com" };
    (globalThis.HybridWebView.InvokeDotNet as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await bridge.users.add("Bob", "bob@x.com");

    expect(globalThis.HybridWebView.InvokeDotNet).toHaveBeenCalledWith("AddUser", ["Bob", "bob@x.com"]);
    expect(result).toEqual(created);
  });
});
