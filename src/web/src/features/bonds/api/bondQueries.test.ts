import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { bondKeys, fetchValuations, valuationsQuery } from "./bondQueries";

describe("bondKeys", () => {
  it("namespaces valuations under the bonds root", () => {
    expect(bondKeys.valuations()).toEqual(["bonds", "valuations"]);
  });
});

describe("valuationsQuery", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the valuations key", () => {
    expect(valuationsQuery().queryKey).toEqual(["bonds", "valuations"]);
  });

  it("fetches the valuations endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([{ symbol: "12345" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const rows = await fetchValuations();

    expect(rows).toEqual([{ symbol: "12345" }]);
    const request = vi.mocked(fetch).mock.calls[0][0] as Request;
    expect(request.url).toBe("http://api.test/api/valuations");
  });

  it("aborts in flight when the caller's signal fires", async () => {
    vi.mocked(fetch).mockImplementation((...args: unknown[]) => {
      const request = args[0] as Request;
      return new Promise<Response>((_, reject) => {
        request.signal.addEventListener("abort", () => {
          reject(request.signal.reason as Error);
        });
      });
    });

    const controller = new AbortController();
    const promise = fetchValuations(controller.signal);

    controller.abort();

    const error = await promise.catch((e: unknown) => e);

    expect(axios.isCancel(error)).toBe(true);
  });
});
