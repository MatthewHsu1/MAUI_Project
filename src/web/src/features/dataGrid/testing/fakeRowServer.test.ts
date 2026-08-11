import { describe, expect, it, vi } from "vitest";
import { createFakeRowServer } from "./fakeRowServer";

interface Row {
  id: number;
  price: number | null;
}

const seed = (): Row[] => [
  { id: 1, price: 30 },
  { id: 2, price: 10 },
  { id: 3, price: null },
  { id: 4, price: 20 },
];

const make = () => createFakeRowServer<Row, never, number>({ rows: seed(), rowKey: (r) => r.id });

describe("createFakeRowServer", () => {
  it("returns the requested slice in key order when nothing is sorted", async () => {
    const server = make();
    const rows = await server.api.fetchRows({
      offset: 1,
      limit: 2,
      sort: null,
      collapsedGroups: [],
    });
    expect(rows.map((r) => r.id)).toEqual([2, 3]);
  });

  it("sorts by the spec, with nulls last", async () => {
    const server = make();
    const rows = await server.api.fetchRows({
      offset: 0,
      limit: 4,
      sort: { field: "price", direction: "asc", nulls: "last" },
      collapsedGroups: [],
    });
    expect(rows.map((r) => r.id)).toEqual([2, 4, 1, 3]);
  });

  it("reports the total count", async () => {
    const server = make();
    expect(await server.api.fetchCount({ collapsedGroups: [] })).toBe(4);
  });

  it("returns one row by id, and null when it is gone", async () => {
    const server = make();
    expect(await server.api.fetchRow(2)).toEqual({ id: 2, price: 10 });
    expect(await server.api.fetchRow(99)).toBeNull();
  });

  it("applies an update and returns the stored row", async () => {
    const server = make();
    const res = await server.api.updateRow({ id: 2, changes: { price: 99 } });
    expect(res).toEqual({ ok: true, row: { id: 2, price: 99 } });
    expect(await server.api.fetchRow(2)).toEqual({ id: 2, price: 99 });
  });

  it("delivers pushes to a subscriber, with rising sequence numbers", () => {
    const server = make();
    const handler = vi.fn();
    const stop = server.api.subscribe(handler);

    server.push({ kind: "update", id: 2 });
    server.push({ kind: "delete", id: 3 });

    expect(handler.mock.calls.map((c) => c[0])).toEqual([
      { kind: "update", id: 2, sequence: 1 },
      { kind: "delete", id: 3, sequence: 2 },
    ]);

    stop();
    server.push({ kind: "update", id: 1 });
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
