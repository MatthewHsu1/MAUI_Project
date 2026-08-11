import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestRow } from "../api/types";
import { testGridHandlers } from "./handlers";
import { mockConfig, setMockConfig } from "./mockConfig";
import { testRowStore } from "./testRowStore";

const BASE = "http://api.test";

const server = setupServer(...testGridHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  // Real delay would make every case wait, and a random failure would make
  // every case flaky. Both are opt-in per case.
  setMockConfig({ latencyMs: 0, failureRate: 0 });
  testRowStore.reset();
});

afterEach(() => server.resetHandlers());

describe("testGrid handlers", () => {
  it("serves a slice with the requested offset and limit", async () => {
    const res = await fetch(`${BASE}/api/test-rows?offset=10&limit=3`);
    const rows = (await res.json()) as TestRow[];

    expect(res.status).toBe(200);
    expect(rows.map((r) => r.id)).toEqual([11, 12, 13]);
  });

  it("reads the sort out of the query string", async () => {
    const res = await fetch(
      `${BASE}/api/test-rows?offset=0&limit=5&sortField=price&sortDir=desc&nulls=last`,
    );
    const rows = (await res.json()) as TestRow[];
    const prices = rows.map((r) => r.price);

    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it("reports the total", async () => {
    const res = await fetch(`${BASE}/api/test-rows/count`);

    expect(await res.json()).toEqual({ count: 100_000 });
  });

  it("drops a collapsed sector from the total", async () => {
    const res = await fetch(`${BASE}/api/test-rows/count?collapsed=Aerospace`);
    const { count } = (await res.json()) as { count: number };

    expect(count).toBeLessThan(100_000);
  });

  it("serves one row by id", async () => {
    const res = await fetch(`${BASE}/api/test-rows/7`);

    expect(((await res.json()) as TestRow).id).toBe(7);
  });

  it("answers 404 for an unknown id", async () => {
    expect((await fetch(`${BASE}/api/test-rows/999999`)).status).toBe(404);
  });

  it("applies a PATCH and returns the recomputed row", async () => {
    const res = await fetch(`${BASE}/api/test-rows/7`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: 2, price: 3 }),
    });
    const row = (await res.json()) as TestRow;

    expect(res.status).toBe(200);
    expect(row.value).toBe(6);
  });

  it("keeps a PATCH, so a later GET sees it", async () => {
    await fetch(`${BASE}/api/test-rows/7`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Edited" }),
    });

    const row = (await (await fetch(`${BASE}/api/test-rows/7`)).json()) as TestRow;
    expect(row.name).toBe("Edited");
  });

  it("answers 404 when PATCH names an unknown id", async () => {
    const res = await fetch(`${BASE}/api/test-rows/999999`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Edited" }),
    });

    expect(res.status).toBe(404);
  });

  it("restores the data on reset", async () => {
    await fetch(`${BASE}/api/test-rows/7`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Edited" }),
    });

    const reset = await fetch(`${BASE}/api/test-rows/reset`, { method: "POST" });
    expect(await reset.json()).toEqual({ count: 100_000 });

    const row = (await (await fetch(`${BASE}/api/test-rows/7`)).json()) as TestRow;
    expect(row.name).not.toBe("Edited");
  });

  it("fails every request at a failure rate of 1", async () => {
    setMockConfig({ failureRate: 1 });

    expect((await fetch(`${BASE}/api/test-rows?offset=0&limit=1`)).status).toBe(500);
    expect((await fetch(`${BASE}/api/test-rows/count`)).status).toBe(500);
  });

  it("patches one field without disturbing the other", () => {
    setMockConfig({ latencyMs: 0, failureRate: 0 });
    setMockConfig({ failureRate: 0.25 });

    expect(mockConfig).toEqual({ latencyMs: 0, failureRate: 0.25 });
  });
});
