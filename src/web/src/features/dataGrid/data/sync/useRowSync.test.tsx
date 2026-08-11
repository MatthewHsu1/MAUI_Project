import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeRowServer } from "../../testing/fakeRowServer";
import type { GridDescriptor } from "../../types";
import { rowsKeyPrefix } from "../../hooks/useRowPages";
import { rowCountKey } from "../rowCount";
import { createRowStore, type RowStore } from "../rowStore";
import { PUSH_BUFFER_MS, useRowSync } from "./useRowSync";

interface Row {
  id: number;
  price: number;
}

const PAGE = 100;

const INITIAL: Row[] = [
  { id: 1, price: 10 },
  { id: 2, price: 20 },
];

/**
 * A store already holding the grid's first page, which is the state every case
 * here starts from: the subscriber only acts on rows some window has loaded.
 */
function loadedStore(rows: Row[] = INITIAL): RowStore<Row, number> {
  const store = createRowStore<Row, number>(PAGE, (r) => r.id);

  store.writePage(0, rows);

  return store;
}

function harness(store: RowStore<Row, number> = loadedStore()) {
  const server = createFakeRowServer<Row, never, number>({
    rows: [...INITIAL],
    rowKey: (r) => r.id,
  });

  const descriptor = {
    name: "demo",
    rowKey: (r: Row) => r.id,
    columns: { defs: {}, defaultOrder: [] },
    api: server.api,
    cells: { makeCell: () => ({}) as never, customRenderers: [], validateCell: () => true },
  } as unknown as GridDescriptor<Row, never, number>;

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const storeRef: { current: RowStore<Row, number> | null } = { current: store };

  // Null outside a hold, which is where most cases here sit. A case that wants
  // the two-store behaviour assigns it.
  const pendingStoreRef: { current: RowStore<Row, number> | null } = { current: null };

  // The grid's data generation. A create or a delete bumps it instead of
  // emptying the store, so the rows on screen stay there while `useGridData`
  // loads their replacements behind them.
  const bumpDataGeneration = vi.fn();

  // The grid's one damage callback. A patched row changes nothing React
  // watches, so this call is the only thing that would put a pushed update on
  // screen.
  const repaint = vi.fn<(dataIndexes: number[]) => void>();

  const instance = { descriptor, storeRef, pendingStoreRef, bumpDataGeneration } as never;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    server,
    descriptor,
    store,
    storeRef,
    pendingStoreRef,
    bumpDataGeneration,
    queryClient,
    repaint,
    instance,
    wrapper,
  };
}

/** The row the store holds at a key, or undefined once it has dropped it. */
function rowOf(store: RowStore<Row, number>, key: number): Row | undefined {
  const index = store.indexOfKey(key);

  if (index === undefined) {
    return undefined;
  }

  return store.getRow(index);
}

describe("useRowSync", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("patches a loaded row after an update push", async () => {
    const { server, store, instance, repaint, wrapper } = harness();

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.setRows([
      { id: 1, price: 999 },
      { id: 2, price: 20 },
    ]);
    server.push({ kind: "update", id: 1 });

    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);
    await waitFor(() => expect(rowOf(store, 1)?.price).toBe(999));
  });

  it("ignores an update for a row it never loaded", async () => {
    const { server, descriptor, instance, repaint, wrapper } = harness();
    const fetchRow = vi.spyOn(descriptor.api, "fetchRow");

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.push({ kind: "update", id: 42 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    expect(fetchRow).not.toHaveBeenCalled();
  });

  it("patches a row only the pending store holds, and asks it before dropping an update", async () => {
    // During a hold the window may move, so the pending store can hold a page
    // the displayed one never fetched. Asking the displayed store alone answers
    // "nobody has this row" and the update is dropped with no fetch at all —
    // and adoption then puts the stale value on screen.
    const { server, store, pendingStoreRef, instance, repaint, wrapper } = harness(
      loadedStore([{ id: 1, price: 10 }]),
    );

    const pendingStore = loadedStore([{ id: 2, price: 20 }]);
    pendingStoreRef.current = pendingStore;

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.setRows([
      { id: 1, price: 10 },
      { id: 2, price: 777 },
    ]);
    server.push({ kind: "update", id: 2 });

    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);
    await waitFor(() => expect(rowOf(pendingStore, 2)?.price).toBe(777));

    // The displayed store does not hold row 2, so `patchRow` finds nothing
    // there and writes nothing.
    expect(rowOf(store, 2)).toBeUndefined();
    expect(rowOf(store, 1)?.price).toBe(10);
  });

  it("repaints the displayed store's index after an update push", async () => {
    // The patch bumps no generation and invalidates no query, so nothing
    // re-renders. Without this damage call the row keeps the value it was drawn
    // with until its page is evicted.
    const { server, store, instance, repaint, wrapper } = harness();

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.setRows([
      { id: 1, price: 10 },
      { id: 2, price: 555 },
    ]);
    server.push({ kind: "update", id: 2 });

    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);
    await waitFor(() => expect(rowOf(store, 2)?.price).toBe(555));

    // Row 2 sits at index 1, so a repaint hardcoded to the first row cannot
    // satisfy this.
    expect(repaint).toHaveBeenCalledWith([1]);
  });

  it("repaints nothing for a row only the pending store holds", async () => {
    // The pending store is drawn by nothing, and it numbers its rows in its own
    // index space — a different sort, a different collapse set, or the same
    // rows shifted by a create. Its answer reaching the damage callback would
    // repaint whichever row of the DISPLAYED view happens to carry that number.
    const { server, pendingStoreRef, instance, repaint, wrapper } = harness(
      loadedStore([{ id: 1, price: 10 }]),
    );

    const pendingStore = loadedStore([{ id: 2, price: 20 }]);
    pendingStoreRef.current = pendingStore;

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.setRows([
      { id: 1, price: 10 },
      { id: 2, price: 777 },
    ]);
    server.push({ kind: "update", id: 2 });

    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);
    await waitFor(() => expect(rowOf(pendingStore, 2)?.price).toBe(777));

    // The pending store answered index 0. The displayed store holds row 1
    // there, and that row did not change.
    expect(repaint).not.toHaveBeenCalled();
  });

  it("drops nothing when no grid is mounted, because there is no store to write to", async () => {
    const { server, descriptor, storeRef, instance, repaint, wrapper } = harness();
    storeRef.current = null;

    const fetchRow = vi.spyOn(descriptor.api, "fetchRow");

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.push({ kind: "update", id: 1 });

    // No throw, no fetch. The next mount loads fresh rows anyway.
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    expect(fetchRow).not.toHaveBeenCalled();
  });

  it("invalidates every row on a delete, and keeps the other rows on an update", async () => {
    // A create and a delete both move every position after them, and a
    // page-indexed cache cannot be shifted in place. An update moves nothing,
    // so it patches the one row it names and every other row stays.
    const { server, store, bumpDataGeneration, instance, repaint, wrapper } = harness();

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.setRows([
      { id: 1, price: 999 },
      { id: 2, price: 20 },
    ]);
    server.push({ kind: "update", id: 1 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    await waitFor(() => expect(rowOf(store, 1)?.price).toBe(999));
    expect(rowOf(store, 2)?.price).toBe(20);

    // An update moves no position, so it invalidates nothing.
    expect(bumpDataGeneration).not.toHaveBeenCalled();

    server.push({ kind: "delete", id: 2 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    await waitFor(() => expect(bumpDataGeneration).toHaveBeenCalledTimes(1));

    // The store the user is looking at is NOT emptied. Clearing it here left
    // every page reading "missing" with no load effect re-running to ask for
    // them again, so the grid stayed blank until the window moved.
    expect(store.getRow(0)).toBeDefined();
    expect(store.pageState(0)).toBe("loaded");
  });

  it("invalidates every row on a create push, without blanking the store on screen", async () => {
    const { server, store, bumpDataGeneration, instance, repaint, wrapper } = harness();

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.push({ kind: "create", id: 3 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    await waitFor(() => expect(bumpDataGeneration).toHaveBeenCalledTimes(1));

    expect(store.getRow(0)).toBeDefined();
  });

  it("drops the cached pages before it bumps, so the replacement rows come from the server", async () => {
    // The page cache is a second copy of the rows, keyed by page and not by
    // generation. Leave it and the store `useGridData` builds for the new
    // generation refills itself from the very response the create invalidated.
    const { server, descriptor, queryClient, instance, repaint, wrapper } = harness();

    const removeQueries = vi.spyOn(queryClient, "removeQueries");

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.push({ kind: "create", id: 3 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    await waitFor(() =>
      expect(removeQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: rowsKeyPrefix(descriptor.name) }),
      ),
    );
  });

  it("makes one fetch for several updates to the same row", async () => {
    const { server, descriptor, instance, repaint, wrapper } = harness();

    const fetchRow = vi.spyOn(descriptor.api, "fetchRow");
    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.push({ kind: "update", id: 1 });
    server.push({ kind: "update", id: 1 });
    server.push({ kind: "update", id: 1 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    expect(fetchRow).toHaveBeenCalledTimes(1);
  });

  it("stops listening when it unmounts", async () => {
    const { server, descriptor, instance, repaint, wrapper } = harness();
    const fetchRow = vi.spyOn(descriptor.api, "fetchRow");

    const { unmount } = renderHook(() => useRowSync(instance, [], repaint), { wrapper });
    unmount();

    server.push({ kind: "update", id: 1 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    expect(fetchRow).not.toHaveBeenCalled();
  });

  it("keeps the newer fetch result when the older fetch resolves last", async () => {
    const { server, descriptor, store, instance, repaint, wrapper } = harness();

    // Two separate buffer windows, each triggering its own `fetchRow` call,
    // with resolution under our control rather than timer luck: the FIRST
    // call (older push) is made to resolve LAST, deliberately out of order.
    let resolveOlder!: (row: Row) => void;
    let resolveNewer!: (row: Row) => void;
    const olderFetch = new Promise<Row>((resolve) => {
      resolveOlder = resolve;
    });
    const newerFetch = new Promise<Row>((resolve) => {
      resolveNewer = resolve;
    });

    const fetchRow = vi.spyOn(descriptor.api, "fetchRow");
    fetchRow.mockImplementationOnce(() => olderFetch);
    fetchRow.mockImplementationOnce(() => newerFetch);

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.push({ kind: "update", id: 1 }); // flush A -> fetchRow call #1 (older)
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    server.push({ kind: "update", id: 1 }); // flush B -> fetchRow call #2 (newer)
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    expect(fetchRow).toHaveBeenCalledTimes(2);

    // The NEWER flush's fetch resolves first.
    resolveNewer({ id: 1, price: 222 });
    await waitFor(() => expect(rowOf(store, 1)?.price).toBe(222));

    // The OLDER flush's fetch resolves after — it must not win.
    resolveOlder({ id: 1, price: 111 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);

    expect(rowOf(store, 1)?.price).toBe(222);
  });

  it("still applies a later push while an earlier fetch never resolves", async () => {
    const { server, descriptor, store, instance, repaint, wrapper } = harness();

    const fetchRow = vi.spyOn(descriptor.api, "fetchRow");
    // The first call (id 1) never settles. The second call (id 2) is left
    // to fall through to the real fake-server implementation.
    fetchRow.mockImplementationOnce(() => new Promise<Row | null>(() => {}));

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.push({ kind: "update", id: 1 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);
    expect(fetchRow).toHaveBeenCalledTimes(1);

    server.setRows([
      { id: 1, price: 10 },
      { id: 2, price: 888 },
    ]);
    server.push({ kind: "update", id: 2 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    await waitFor(() => expect(rowOf(store, 2)?.price).toBe(888));
  });

  it("invalidates the count with the current collapsed groups after a rerender", async () => {
    const { server, descriptor, queryClient, instance, repaint, wrapper } = harness();

    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(({ groups }) => useRowSync(instance, groups, repaint), {
      wrapper,
      initialProps: { groups: [] as number[] },
    }).rerender({ groups: [7] });

    server.push({ kind: "create", id: 3 }); // a create always sets `recount`
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: rowCountKey(descriptor.name, [7]) }),
      ),
    );
  });

  it("still applies a slow flush's write when a later flush's plan is empty", async () => {
    const { server, descriptor, store, instance, repaint, wrapper } = harness();

    // Flush A (id 1, loaded) is left pending on a controlled fetch. Flush B
    // (id 99, never loaded) has an entirely empty plan — no delete, no
    // refetch, no reload, no recount — so it must not be able to affect
    // flush A's ordering state at all, whether or not it runs first.
    let resolveSlow!: (row: Row) => void;
    const slowFetch = new Promise<Row>((resolve) => {
      resolveSlow = resolve;
    });
    const fetchRow = vi.spyOn(descriptor.api, "fetchRow");
    fetchRow.mockImplementationOnce(() => slowFetch);

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.push({ kind: "update", id: 1 }); // flush A: loaded row, slow fetch
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    server.push({ kind: "update", id: 99 }); // flush B: unloaded row, empty plan
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    resolveSlow({ id: 1, price: 777 });
    await waitFor(() => expect(rowOf(store, 1)?.price).toBe(777));
  });

  it("still runs reload and recount for a slow create flush overtaken by a later flush", async () => {
    const {
      server,
      descriptor,
      store,
      bumpDataGeneration,
      queryClient,
      instance,
      repaint,
      wrapper,
    } = harness();

    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    // Flush A carries BOTH pushes in ONE buffer window, so its plan holds a
    // `fetchRow` this test can keep pending AND the `reload` + `recount` a
    // create sets. That is what makes it the OLDER, SLOWER flush.
    let resolveSlow!: (row: Row) => void;
    const slowFetch = new Promise<Row>((resolve) => {
      resolveSlow = resolve;
    });
    const fetchRow = vi.spyOn(descriptor.api, "fetchRow");
    fetchRow.mockImplementationOnce(() => slowFetch);

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.push({ kind: "update", id: 1 });
    server.push({ kind: "create", id: 3 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    expect(fetchRow).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).not.toHaveBeenCalled();

    // Flush B is younger and faster, and commits an ordinary per-key update
    // while flush A is still waiting on its fetch.
    server.setRows([
      { id: 1, price: 10 },
      { id: 2, price: 55 },
    ]);
    server.push({ kind: "update", id: 2 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);
    await waitFor(() => expect(rowOf(store, 2)?.price).toBe(55));

    // Flush A lands last. Nothing about `reload` or `recount` is a per-key
    // overwrite, so neither may be gated behind the per-key staleness check
    // that a newer flush advanced.
    resolveSlow({ id: 1, price: 777 });

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: rowCountKey(descriptor.name, []) }),
      ),
    );

    // The reload ran too: a create moves every position after it, so every
    // loaded row is invalidated rather than shifted. The rows on screen are
    // untouched — the replacement loads behind them.
    await waitFor(() => expect(bumpDataGeneration).toHaveBeenCalledTimes(1));
    expect(rowOf(store, 2)?.price).toBe(55);
  });

  it("still applies a later push after an earlier fetch rejects", async () => {
    const { server, descriptor, store, instance, repaint, wrapper } = harness();

    const fetchRow = vi.spyOn(descriptor.api, "fetchRow");
    fetchRow.mockImplementationOnce(() => Promise.reject(new Error("network error")));

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    server.push({ kind: "update", id: 1 }); // flush A: fetchRow rejects
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    server.setRows([
      { id: 1, price: 10 },
      { id: 2, price: 321 },
    ]);
    server.push({ kind: "update", id: 2 }); // flush B: real fetchRow, must still apply
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    await waitFor(() => expect(rowOf(store, 2)?.price).toBe(321));
  });

  it("keeps one subscription across a store swap, and writes land on the new store", async () => {
    const {
      server,
      descriptor,
      store: firstStore,
      storeRef,
      instance,
      repaint,
      wrapper,
    } = harness();

    // Wraps the fake server's real `subscribe` so the test can also see
    // whether the UNSUBSCRIBE function it hands back ever runs, not just how
    // many times `subscribe` itself was called. `descriptor.api` IS
    // `server.api` (see `harness`), so the original implementation is
    // captured BEFORE `vi.spyOn` replaces it — calling `server.api.subscribe`
    // from inside the mock would otherwise call the mock itself and recurse.
    const originalSubscribe = descriptor.api.subscribe!;
    const unsubscribeSpy = vi.fn();
    const subscribe = vi
      .spyOn(descriptor.api, "subscribe")
      .mockImplementation(
        (handler: Parameters<NonNullable<typeof descriptor.api.subscribe>>[0]) => {
          const stop = originalSubscribe(handler);

          return () => {
            unsubscribeSpy();
            stop();
          };
        },
      );

    const { rerender } = renderHook(() => useRowSync(instance, [], repaint), { wrapper });
    expect(subscribe).toHaveBeenCalledTimes(1);

    // A remount hands the ref a different store without the ref's own identity
    // ever changing.
    const secondStore = loadedStore();
    storeRef.current = secondStore;

    rerender();

    // The swap must not tear the subscription down and rebuild it.
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).not.toHaveBeenCalled();

    server.setRows([
      { id: 1, price: 999 },
      { id: 2, price: 20 },
    ]);
    server.push({ kind: "update", id: 1 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    // The write lands on the store that is current AT FLUSH TIME — the second
    // one — and never touches the first, retired store.
    await waitFor(() => expect(rowOf(secondStore, 1)?.price).toBe(999));
    expect(rowOf(firstStore, 1)?.price).toBe(10);
  });

  it("clears its per-key ordering state once every flush settles", async () => {
    const { server, descriptor, store, instance, repaint, wrapper } = harness();

    renderHook(() => useRowSync(instance, [], repaint), { wrapper });

    // First cycle: drains fully with the real (fast) `fetchRow`, so the
    // in-flight count returns to 0 and the per-key ordering state should be
    // cleared before the second cycle starts.
    server.push({ kind: "update", id: 1 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);
    await waitFor(() => expect(rowOf(store, 1)?.price).toBe(10));
    await vi.advanceTimersByTimeAsync(0); // let the first flush's `finally` settle

    // Second, independent cycle for the SAME key, with a controlled slow
    // fetch. This is the observable consequence of clearing: if the first
    // cycle's per-key entry (and the reused, reset generation counter) were
    // never cleared, this cycle's write would collide with that leftover
    // entry and be wrongly discarded as "stale" even though it is the only
    // write in flight.
    let resolveSecond!: (row: Row) => void;
    const secondFetch = new Promise<Row>((resolve) => {
      resolveSecond = resolve;
    });
    const fetchRow = vi.spyOn(descriptor.api, "fetchRow");
    fetchRow.mockImplementationOnce(() => secondFetch);

    server.push({ kind: "update", id: 1 });
    await vi.advanceTimersByTimeAsync(PUSH_BUFFER_MS + 1);

    resolveSecond({ id: 1, price: 999 });
    await waitFor(() => expect(rowOf(store, 1)?.price).toBe(999));
  });
});
