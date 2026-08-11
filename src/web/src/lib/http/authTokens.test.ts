import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAccessToken,
  setAccessToken,
  refreshAccessToken,
  setRefreshHandler,
  resetAuthTokensForTest,
} from "./authTokens";

describe("authTokens", () => {
  beforeEach(() => {
    resetAuthTokensForTest();
  });

  it("starts with no token", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("stores and clears the token", () => {
    setAccessToken("abc");
    expect(getAccessToken()).toBe("abc");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("stores the refreshed token", async () => {
    setRefreshHandler(async () => "fresh");
    const token = await refreshAccessToken();
    expect(token).toBe("fresh");
    expect(getAccessToken()).toBe("fresh");
  });

  it("runs one refresh for concurrent callers", async () => {
    const handler = vi.fn(async () => "fresh");
    setRefreshHandler(handler);

    const results = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(results).toEqual(["fresh", "fresh", "fresh"]);
  });

  it("allows a later refresh after one fails", async () => {
    const handler = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("fresh");
    setRefreshHandler(handler);

    await expect(refreshAccessToken()).rejects.toThrow("boom");
    await expect(refreshAccessToken()).resolves.toBe("fresh");
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("clears the token when refresh fails", async () => {
    setAccessToken("stale");
    setRefreshHandler(async () => {
      throw new Error("boom");
    });

    await expect(refreshAccessToken()).rejects.toThrow("boom");
    expect(getAccessToken()).toBeNull();
  });
});
