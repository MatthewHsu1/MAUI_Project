import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import {
  bondKeys,
  fetchValuation,
  fetchValuationCount,
  fetchValuations,
  valuationCountQuery,
  valuationsQuery,
} from "./bondQueries";

/** The window the grid asks for first, unsorted and unfiltered. */
const firstPage = { offset: 0, limit: 100, sort: null };

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

describe("bondKeys", () => {
  it("namespaces the slice and the count under the bonds root", () => {
    expect(bondKeys.valuations(firstPage)).toEqual(["bonds", "valuations", firstPage]);
    expect(bondKeys.valuationCount({ symbol: "110" })).toEqual([
      "bonds",
      "valuations",
      "count",
      { symbol: "110" },
    ]);
  });

  it("keys two windows of the same order apart", () => {
    expect(bondKeys.valuations(firstPage)).not.toEqual(
      bondKeys.valuations({ ...firstPage, offset: 100 }),
    );
  });
});

describe("valuation queries", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the slice key and the count key", () => {
    expect(valuationsQuery(firstPage).queryKey).toEqual(bondKeys.valuations(firstPage));
    expect(valuationCountQuery().queryKey).toEqual(bondKeys.valuationCount(undefined));
  });

  it("sends the window and the order, and returns the slice", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([{ symbol: "12345" }]));

    const rows = await fetchValuations({
      offset: 200,
      limit: 50,
      sort: { field: "conversionValue", direction: "desc", nulls: "first" },
    });

    expect(rows).toEqual([{ symbol: "12345" }]);
    expect(requestAt(0).url).toBe(
      "http://api.test/api/valuations" +
        "?offset=200&limit=50&sortField=conversionValue&sortDir=desc&nulls=first",
    );
  });

  it("omits the sort parameters when nothing is sorted", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    await fetchValuations(firstPage);

    // The server reads a missing sortField as its default order, so sending the
    // three names empty would only invite a 400 on an unknown enum value.
    expect(requestAt(0).url).toBe("http://api.test/api/valuations?offset=0&limit=100");
  });

  it("sends only the filter fields the caller defined", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    await fetchValuations({
      ...firstPage,
      filter: { symbol: "110", inTheMoney: true, minConversionValue: 100000 },
    });

    const url = new URL(requestAt(0).url);
    expect(url.searchParams.get("symbol")).toBe("110");
    expect(url.searchParams.get("inTheMoney")).toBe("true");
    expect(url.searchParams.get("minConversionValue")).toBe("100000");
    expect(url.searchParams.has("maxConversionValue")).toBe(false);
    expect(url.searchParams.has("asOfFrom")).toBe(false);
  });

  it("reads the total out of the count envelope", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ count: 412 }));

    const total = await fetchValuationCount({ filter: { minBondPrice: 95 } });

    expect(total).toBe(412);
    expect(requestAt(0).url).toBe("http://api.test/api/valuations/count?minBondPrice=95");
  });

  it("asks the count endpoint for nothing but the filter", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ count: 0 }));

    await fetchValuationCount({});

    // No offset, limit, or sort: none of them changes a count, and the
    // endpoint does not declare them.
    expect(requestAt(0).url).toBe("http://api.test/api/valuations/count");
  });

  it("resolves one valuation by symbol", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ symbol: "12345" }));

    const row = await fetchValuation("12345");

    expect(row).toEqual({ symbol: "12345" });
    expect(requestAt(0).url).toBe("http://api.test/api/valuations/12345");
  });

  it("reads a 404 on one symbol as a missing row, not a failure", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ title: "Not Found" }, 404));

    await expect(fetchValuation("99999")).resolves.toBeNull();
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
    const promise = fetchValuations({ ...firstPage, signal: controller.signal });

    controller.abort();

    const error = await promise.catch((e: unknown) => e);

    expect(axios.isCancel(error)).toBe(true);
  });
});
