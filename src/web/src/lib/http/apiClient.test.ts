import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { apiClient } from "./apiClient";
import { ApiError } from "./ApiError";
import { setAccessToken, setRefreshHandler, resetAuthTokensForTest } from "./authTokens";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The Request the fetch adapter handed to the stubbed global fetch. */
function requestAt(index: number): Request {
  return vi.mocked(fetch).mock.calls[index][0] as Request;
}

describe("apiClient", () => {
  beforeEach(() => {
    resetAuthTokensForTest();
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("resolves the parsed body against the configured base URL", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([{ symbol: "12345" }]));

    const response = await apiClient.get<{ symbol: string }[]>("/api/valuations");

    expect(response.data).toEqual([{ symbol: "12345" }]);
    expect(requestAt(0).url).toBe("http://api.test/api/valuations");
  });

  it("appends defined query parameters and drops undefined ones", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    await apiClient.get("/api/valuations", {
      params: { offset: 0, limit: 100, filter: undefined },
    });

    expect(requestAt(0).url).toBe("http://api.test/api/valuations?offset=0&limit=100");
  });

  it("attaches the bearer token when one is present", async () => {
    setAccessToken("token-1");
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    await apiClient.get("/api/valuations");

    expect(requestAt(0).headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("omits the Authorization header when unauthenticated", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    await apiClient.get("/api/valuations");

    expect(requestAt(0).headers.has("Authorization")).toBe(false);
  });

  it("wraps a non-2xx response in ApiError with the parsed body as detail", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ title: "Server exploded" }, 500));

    const error = await apiClient.get("/api/valuations").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 500,
      code: "http",
      detail: { title: "Server exploded" },
    });
  });

  it("wraps a network failure in ApiError with status 0", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await apiClient.get("/api/valuations").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: "network" });
  });

  it("tolerates a non-JSON error body, keeping the raw text as detail", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", { status: 502 }),
    );

    const error = await apiClient.get("/api/valuations").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: "http" });
    expect((error as ApiError).detail).toContain("502 Bad Gateway");
  });

  it("returns a 204 with an empty body rather than failing", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    const response = await apiClient.post("/api/valuations/refresh");

    expect(response.status).toBe(204);
    expect(response.data).toBe("");
  });

  it("throws a configuration error, not an ApiError, when the base URL is unset", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");

    const error = await apiClient.get("/api/valuations").catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/VITE_API_BASE_URL/);
  });
});

describe("apiClient auth recovery", () => {
  beforeEach(() => {
    resetAuthTokensForTest();
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("refreshes once and retries after a 401, carrying the fresh token", async () => {
    setAccessToken("stale");
    setRefreshHandler(async () => "fresh");

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse([{ symbol: "12345" }]));

    const response = await apiClient.get<{ symbol: string }[]>("/api/valuations");

    expect(response.data).toEqual([{ symbol: "12345" }]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(requestAt(1).headers.get("Authorization")).toBe("Bearer fresh");
  });

  it("does not loop when the retry also returns 401", async () => {
    setAccessToken("stale");
    setRefreshHandler(async () => "fresh");
    // A fresh Response per call: a native Response body is a single-read
    // stream, so reusing one instance makes the retry's read throw and
    // surface as a network error instead of the 401 under test.
    vi.mocked(fetch).mockImplementation(async () => jsonResponse({ error: "nope" }, 401));

    const error = await apiClient.get("/api/valuations").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: "unauthorized" });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("surfaces a failed refresh as an unauthorized ApiError", async () => {
    setAccessToken("stale");
    setRefreshHandler(async () => {
      throw new Error("refresh endpoint unreachable");
    });
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "expired" }, 401));

    const error = await apiClient.get("/api/valuations").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: "unauthorized" });
    expect((error as ApiError).detail).toBeInstanceOf(Error);
  });

  it("passes a transport-level refresh failure through rather than relabelling it 401", async () => {
    setAccessToken("stale");
    setRefreshHandler(async () => {
      throw new ApiError(0, "network", "Network request failed");
    });
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "expired" }, 401));

    const error = await apiClient.get("/api/valuations").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: "network" });
  });

  it("preserves the request body when retrying after a refresh", async () => {
    setAccessToken("stale");
    setRefreshHandler(async () => "fresh");

    vi.mocked(fetch).mockImplementation(async (...args: unknown[]) => {
      const request = args[0] as Request;
      return request.headers.get("Authorization") === "Bearer fresh"
        ? jsonResponse({ ok: true })
        : jsonResponse({ error: "expired" }, 401);
    });

    await apiClient.post("/api/valuations/refresh", { symbol: "12345" });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(await requestAt(1).clone().text()).toBe(JSON.stringify({ symbol: "12345" }));
  });

  it("collapses concurrent 401s onto a single refresh", async () => {
    setAccessToken("stale");
    const refresh = vi.fn(async () => "fresh");
    setRefreshHandler(refresh);

    vi.mocked(fetch).mockImplementation(async (...args: unknown[]) => {
      const request = args[0] as Request;
      return request.headers.get("Authorization") === "Bearer fresh"
        ? jsonResponse([{ symbol: "12345" }])
        : jsonResponse({ error: "expired" }, 401);
    });

    const responses = await Promise.all([
      apiClient.get("/api/valuations"),
      apiClient.get("/api/valuations"),
      apiClient.get("/api/valuations"),
    ]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
  });

  it("does not attempt a refresh for a request marked skipAuthRefresh", async () => {
    setAccessToken("stale");
    const refresh = vi.fn(async () => "fresh");
    setRefreshHandler(refresh);
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "nope" }, 401));

    const error = await apiClient
      .post("/api/auth/token", undefined, { skipAuthRefresh: true })
      .catch((e: unknown) => e);

    expect(refresh).not.toHaveBeenCalled();
    expect(error).toMatchObject({ status: 401, code: "unauthorized" });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});

describe("apiClient cancellation and timeout", () => {
  /** A fetch that never resolves on its own — it settles only when aborted. */
  function neverResolvingFetch() {
    return vi.fn((...args: unknown[]) => {
      const request = args[0] as Request;
      return new Promise<Response>((_, reject) => {
        request.signal.addEventListener("abort", () => {
          reject(request.signal.reason as Error);
        });
      });
    });
  }

  beforeEach(() => {
    resetAuthTokensForTest();
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    vi.stubGlobal("fetch", neverResolvingFetch());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("maps a timeout to ApiError with code 'timeout'", async () => {
    const error = await apiClient
      .get("/api/valuations", { timeout: 20 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: "timeout" });
  });

  it("rethrows a cancellation rather than wrapping it", async () => {
    const controller = new AbortController();
    const promise = apiClient.get("/api/valuations", { signal: controller.signal });

    controller.abort();

    const error = await promise.catch((e: unknown) => e);

    expect(axios.isCancel(error)).toBe(true);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});
