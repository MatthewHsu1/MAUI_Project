import { describe, expect, it } from "vitest";
import type { ColumnsState } from "../types";
import { localStorageColumnsAdapter } from "./localStorageColumnsAdapter";

// Fake storage backed by a Map
function createFakeStorage(): Pick<Storage, "getItem" | "setItem"> {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
  };
}

describe("localStorageColumnsAdapter", () => {
  it("saveColumns writes JSON", async () => {
    const fake = createFakeStorage();
    const adapter = localStorageColumnsAdapter("testKey", fake);
    const state: ColumnsState = {
      order: ["a", "b"],
      widths: { a: 120, b: 200 },
      hidden: ["c"],
    };

    await adapter.saveColumns(state);

    const raw = fake.getItem("testKey");
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toEqual(state);
  });

  it("loadColumns round-trips", async () => {
    const fake = createFakeStorage();
    const adapter = localStorageColumnsAdapter("testKey", fake);
    const state: ColumnsState = {
      order: ["a", "b"],
      widths: { a: 120 },
      hidden: ["c"],
    };

    await adapter.saveColumns(state);
    const loaded = await adapter.loadColumns();

    expect(loaded).toEqual(state);
  });

  it("loadColumns returns null on missing key", async () => {
    const fake = createFakeStorage();
    const adapter = localStorageColumnsAdapter("testKey", fake);

    const result = await adapter.loadColumns();

    expect(result).toBeNull();
  });

  it("loadColumns returns null on malformed JSON", async () => {
    const fake = createFakeStorage();
    const adapter = localStorageColumnsAdapter("testKey", fake);
    fake.setItem("testKey", "not json{");

    const result = await adapter.loadColumns();

    expect(result).toBeNull();
  });
});
