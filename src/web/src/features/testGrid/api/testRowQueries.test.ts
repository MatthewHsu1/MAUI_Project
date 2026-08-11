import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestRow } from "./types";
import {
  fetchTestRow,
  fetchTestRowCount,
  fetchTestRows,
  resetTestRows,
  updateTestRow,
} from "./testRowQueries";

const row: TestRow = {
  id: 1,
  name: "Northwind Group 1",
  sector: "Aerospace",
  region: 0,
  quantity: 10,
  price: 2.5,
  value: 25,
  contact: "+14150000001",
  updatedAt: "2026-01-01",
  active: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The URL of the single call the stub saw. */
function calledUrl(): URL {
  const [input] = vi.mocked(fetch).mock.calls[0];
  return new URL(input instanceof Request ? input.url : String(input));
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchTestRows", () => {
  it("sends offset, limit, sort, and the collapsed sectors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([row])));

    const rows = await fetchTestRows({
      offset: 100,
      limit: 50,
      sort: { field: "price", direction: "desc", nulls: "last" },
      collapsedGroups: ["Energy", "Media"],
    });

    const url = calledUrl();
    expect(url.pathname).toBe("/api/test-rows");
    expect(url.searchParams.get("offset")).toBe("100");
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("sortField")).toBe("price");
    expect(url.searchParams.get("sortDir")).toBe("desc");
    expect(url.searchParams.get("nulls")).toBe("last");
    expect(url.searchParams.get("collapsed")).toBe("Energy,Media");
    expect(rows).toEqual([row]);
  });

  it("omits the sort parameters when nothing is sorted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    await fetchTestRows({ offset: 0, limit: 10, sort: null, collapsedGroups: [] });

    const url = calledUrl();
    expect(url.searchParams.has("sortField")).toBe(false);
    expect(url.searchParams.get("collapsed")).toBe("");
  });
});

describe("fetchTestRowCount", () => {
  it("unwraps the count", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ count: 42 })));

    expect(await fetchTestRowCount({ collapsedGroups: [] })).toBe(42);
  });
});

describe("fetchTestRow", () => {
  it("returns the row", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(row)));

    expect(await fetchTestRow(1)).toEqual(row);
  });

  it("returns null on 404 rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 404)));

    expect(await fetchTestRow(999)).toBeNull();
  });
});

describe("updateTestRow", () => {
  it("PATCHes the changes and returns the server row", async () => {
    const stub = vi.fn().mockResolvedValue(jsonResponse({ ...row, quantity: 99, value: 247.5 }));
    vi.stubGlobal("fetch", stub);

    const result = await updateTestRow({ id: 1, changes: { quantity: 99 } });

    expect(calledUrl().pathname).toBe("/api/test-rows/1");
    expect(result.ok).toBe(true);
    expect(result.row?.value).toBe(247.5);
  });

  it("returns ok:false when the server rejects the edit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));

    expect(await updateTestRow({ id: 1, changes: { quantity: 99 } })).toEqual({ ok: false });
  });
});

describe("resetTestRows", () => {
  it("POSTs and returns the new count", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ count: 100000 })));

    expect(await resetTestRows()).toBe(100000);
    expect(calledUrl().pathname).toBe("/api/test-rows/reset");
  });
});
