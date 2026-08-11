import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SortSpec } from "../data/sortSpec";
import { createFakeRowServer } from "../testing/fakeRowServer";
import type { GridDescriptor } from "../types";
import { useGridData, type GridDataSource } from "./useGridData";

interface Row {
  id: number;
  name: string;
  g: number;
}

const PAGE = 100;
const GROUP_SIZE = 60;

function makeHarness(total: number, grouped = false) {
  const server = createFakeRowServer<Row, number, number>({
    rows: Array.from({ length: total }, (_, i) => ({
      id: i,
      name: `row-${i}`,
      g: Math.floor(i / GROUP_SIZE),
    })),
    rowKey: (r) => r.id,
    groupOf: (r) => r.g,
  });

  // A gate around every page PAST the first, so a case can let page 0 settle on
  // its own and hold the rest of the window back.
  let openLaterPages: () => void = () => {};
  let laterPageGate: Promise<void> | null = null;

  // Armed by `failFetchRows()` and spent by the NEXT request only. One request,
  // not a mode: a case arms it just before a sort change so that the request
  // the change starts is the one that fails.
  let failNext = false;

  // A gate around ONE page, named by the offset it is requested at, so a case
  // can decide which page of a multi-page window lands last.
  const pageGates = new Map<number, { wait: Promise<void>; open: () => void }>();

  const fetchRows = vi.fn(async (p: Parameters<typeof server.api.fetchRows>[0]) => {
    if (failNext) {
      failNext = false;
      throw new Error("boom");
    }

    if (laterPageGate !== null && p.offset > 0) {
      await laterPageGate;
    }

    const gate = pageGates.get(p.offset);

    if (gate !== undefined) {
      await gate.wait;
    }

    return server.api.fetchRows(p);
  });

  // A gate around the COUNT request, so a case can let the rows of a new
  // collapse set land while its total is still in flight. That order is the one
  // carrying pages creates, and it is the order the old code never met.
  let countGate: (() => void) | null = null;
  let countFails = false;

  const fetchCount = async (p: Parameters<typeof server.api.fetchCount>[0]) => {
    if (countGate !== null) {
      await new Promise<void>((resolve) => {
        countGate = resolve;
      });
    }

    if (countFails) {
      throw new Error("count boom");
    }

    return server.api.fetchCount(p);
  };

  const descriptor = {
    name: "composed",
    rowKey: (r: Row) => r.id,
    pageSize: PAGE,
    columns: { defs: {}, defaultOrder: [] },
    grouping: grouped
      ? { field: "g", of: (r: Row) => r.g, order: (g: number) => g, label: String }
      : undefined,
    api: { ...server.api, fetchRows, fetchCount },
    cells: { makeCell: () => ({}), customRenderers: [], validateCell: () => true },
  } as unknown as GridDescriptor<Row, number, number>;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });

  const instance = {
    descriptor,
    storeRef: { current: null },
    pendingStoreRef: { current: null },
    carryFromRef: { current: null },
    subscribeDataGeneration: () => () => {},
    getDataGeneration: () => 0,
  } as unknown as GridDataSource<Row, number, number>;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    descriptor,
    instance,
    wrapper,
    fetchRows,

    holdLaterPages() {
      laterPageGate = new Promise<void>((resolve) => {
        openLaterPages = resolve;
      });
    },

    releaseLaterPages() {
      openLaterPages();
      laterPageGate = null;
    },

    /** Makes the next page request reject. */
    failFetchRows() {
      failNext = true;
    },

    /** Blocks the next count request until `releaseCount()` runs. */
    holdCount() {
      countGate = () => {};
    },

    releaseCount() {
      const open = countGate;
      countGate = null;
      open?.();
    },

    /** Makes every count request from now on reject. */
    failCount() {
      countFails = true;
    },

    /** Blocks every request for the page starting at this offset. */
    holdPage(offset: number) {
      let open: () => void = () => {};
      const wait = new Promise<void>((resolve) => {
        open = resolve;
      });

      pageGates.set(offset, { wait, open });
    },

    /** Removed BEFORE it opens, so a re-request of the same page runs free. */
    releasePage(offset: number) {
      const gate = pageGates.get(offset);
      pageGates.delete(offset);
      gate?.open();
    },
  };
}

/**
 * The store the hold is filling.
 *
 * It FAILS when there is no hold, rather than reading through an optional chain
 * that answers undefined for "no store" and for "the store does not hold that
 * row" alike. Every assertion about a carried page needs the two apart.
 */
function pendingStore(h: ReturnType<typeof makeHarness>) {
  const store = h.instance.pendingStoreRef.current;

  expect(store).not.toBeNull();

  return store!;
}

describe("useGridData", () => {
  it("serves a row by data index once its page lands", async () => {
    const h = makeHarness(10_000);

    const { result } = renderHook(
      () => useGridData(h.instance, { offset: 0, limit: PAGE }, null, [], () => {}),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(result.current.rowAt(5)).toBeDefined());

    expect(result.current.rowAt(5)?.name).toBe("row-5");
    expect(result.current.total).toBe(10_000);
    expect(result.current.status).toBe("ready");
  });

  it("keeps the same store across renders, so rows survive a window move", async () => {
    const h = makeHarness(10_000);

    const { result, rerender } = renderHook(
      ({ offset }: { offset: number }) =>
        useGridData(h.instance, { offset, limit: PAGE }, null, [], () => {}),
      { wrapper: h.wrapper, initialProps: { offset: 0 } },
    );

    await waitFor(() => expect(result.current.rowAt(0)).toBeDefined());

    const store = result.current.store;

    rerender({ offset: 100 });
    await waitFor(() => expect(result.current.rowAt(100)).toBeDefined());

    expect(result.current.store).toBe(store);
    expect(result.current.rowAt(0)?.name).toBe("row-0");
  });

  it("lays an optimistic value over the stored row", async () => {
    const h = makeHarness(1_000);

    const { result } = renderHook(
      () => useGridData(h.instance, { offset: 0, limit: PAGE }, null, [], () => {}),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(result.current.rowAt(5)).toBeDefined());

    result.current.overlay.begin(5, "name", "typed");

    expect(result.current.rowAt(5)?.name).toBe("typed");
    expect(result.current.isPending(5)).toBe(true);
  });

  it("restores the stored value when an optimistic edit rolls back", async () => {
    const h = makeHarness(1_000);

    const { result } = renderHook(
      () => useGridData(h.instance, { offset: 0, limit: PAGE }, null, [], () => {}),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(result.current.rowAt(5)).toBeDefined());

    result.current.overlay.begin(5, "name", "typed");
    result.current.overlay.rollback(5, "name");

    expect(result.current.rowAt(5)?.name).toBe("row-5");
    expect(result.current.isPending(5)).toBe(false);
  });

  it("reports a span the display model can place group headers from", async () => {
    const h = makeHarness(1_000, true);

    const { result } = renderHook(
      () => useGridData(h.instance, { offset: 100, limit: PAGE }, null, [], () => {}),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(result.current.span.rows.length).toBeGreaterThan(0));

    expect(result.current.span.offset).toBe(100);
    expect(result.current.span.rows[0].id).toBe(100);
    expect(result.current.span.precedingGroupKey).toBe(1);
  });

  it("throws away every row when the sort changes, because positions moved", async () => {
    const h = makeHarness(1_000);

    const { result, rerender } = renderHook(
      ({ sort }: { sort: SortSpec | null }) =>
        useGridData(h.instance, { offset: 0, limit: PAGE }, sort, [], () => {}),
      { wrapper: h.wrapper, initialProps: { sort: null as SortSpec | null } },
    );

    await waitFor(() => expect(result.current.rowAt(0)?.name).toBe("row-0"));

    rerender({ sort: { field: "name", direction: "desc", nulls: "last" } });

    await waitFor(() => expect(result.current.rowAt(0)?.name).toBe("row-999"));
  });

  it("throws away every row when the collapse set changes", async () => {
    const h = makeHarness(1_000, true);

    const { result, rerender } = renderHook(
      ({ collapsed }: { collapsed: number[] }) =>
        useGridData(h.instance, { offset: 0, limit: PAGE }, null, collapsed, () => {}),
      { wrapper: h.wrapper, initialProps: { collapsed: [] as number[] } },
    );

    await waitFor(() => expect(result.current.total).toBe(1_000));

    rerender({ collapsed: [0] });

    await waitFor(() => expect(result.current.total).toBe(940));
    expect(result.current.rowAt(0)?.id).toBe(GROUP_SIZE);
  });

  it("reports an error for a failed visible page even though the widened preceding page loaded", async () => {
    const h = makeHarness(1_000, true);
    let failVisiblePage = true;

    const fetchRows = async (p: Parameters<typeof h.descriptor.api.fetchRows>[0]) => {
      if (p.offset === PAGE && failVisiblePage) {
        throw new Error("boom");
      }

      return h.descriptor.api.fetchRows(p);
    };

    const descriptor = { ...h.descriptor, api: { ...h.descriptor.api, fetchRows } };
    const instance = {
      descriptor,
      storeRef: { current: null },
      pendingStoreRef: { current: null },
      carryFromRef: { current: null },
      subscribeDataGeneration: () => () => {},
      getDataGeneration: () => 0,
    } as unknown as GridDataSource<Row, number, number>;

    const { result } = renderHook(
      () => useGridData(instance, { offset: PAGE, limit: PAGE }, null, [], () => {}),
      { wrapper: h.wrapper },
    );

    // Page 0 (rows 0-99, fetched only to supply `precedingGroupKey`) loads
    // fine; page 1 (rows 100-199, the whole visible window) fails. Without the
    // fix, `status` reads "ready" because SOME page in the widened set loaded.
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.span.rows.length).toBe(0);

    failVisiblePage = false;
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.rowAt(PAGE)?.name).toBe(`row-${PAGE}`);
  });

  it("requests only its own pages for an off-boundary grouped window, no extra one", async () => {
    const h = makeHarness(1_000, true);
    const fetchRows = vi.fn(h.descriptor.api.fetchRows);
    const descriptor = { ...h.descriptor, api: { ...h.descriptor.api, fetchRows } };
    const instance = {
      descriptor,
      storeRef: { current: null },
      pendingStoreRef: { current: null },
      carryFromRef: { current: null },
      subscribeDataGeneration: () => () => {},
      getDataGeneration: () => 0,
    } as unknown as GridDataSource<Row, number, number>;

    const { result } = renderHook(
      () => useGridData(instance, { offset: 150, limit: PAGE }, null, [], () => {}),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(result.current.span.rows.length).toBeGreaterThan(0));

    const requestedOffsets = fetchRows.mock.calls
      .map((call) => call[0].offset)
      .sort((a, b) => a - b);

    // Offset 150 with a page size of 100 spans pages 1 and 2 (rows 100-299)
    // without ever touching a page boundary, so no extra page is needed for
    // `precedingGroupKey` and none should be requested.
    expect(requestedOffsets).toEqual([100, 200]);
  });

  it("publishes its store on the instance, so the push subscriber can reach it", async () => {
    const h = makeHarness(1_000);

    const { result } = renderHook(
      () => useGridData(h.instance, { offset: 0, limit: PAGE }, null, [], () => {}),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(result.current.rowAt(0)).toBeDefined());

    expect(h.instance.storeRef.current).toBe(result.current.store);
  });
  it("grows the span as the window's later pages settle, not only when status first moves", async () => {
    // `statusOf` answers "ready" as soon as ONE page of the window is loaded,
    // and a window covers three. A span memo keyed on `status` therefore
    // recomputes once, at page 0, and never again — and `spanFromStore` stops
    // at the first hole, so the span would stay 100 rows wide for a 300-row
    // window. `useDisplayModel` reads every group boundary out of `span.rows`.
    const h = makeHarness(1_000, true);
    h.holdLaterPages();

    const { result } = renderHook(
      () => useGridData(h.instance, { offset: 0, limit: 300 }, null, [], () => {}),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(result.current.span.rows.length).toBe(PAGE));
    expect(result.current.status).toBe("ready");

    h.releaseLaterPages();

    await waitFor(() => expect(result.current.span.rows.length).toBe(300));

    // `status` never moved again, so only a settle-driven recompute can have
    // produced this. Group 2 opens at row 120, past the first page.
    expect(result.current.status).toBe("ready");
    expect(result.current.span.rows.some((row) => row.id === 120 && row.g === 2)).toBe(true);
  });

  it("keeps the previous rows on screen while a new sort loads", async () => {
    const h = makeHarness(1_000);

    const { result, rerender } = renderHook(
      ({ sort }: { sort: SortSpec | null }) =>
        useGridData(h.instance, { offset: 0, limit: PAGE }, sort, [], () => {}),
      { wrapper: h.wrapper, initialProps: { sort: null as SortSpec | null } },
    );

    await waitFor(() => expect(result.current.rowAt(0)?.name).toBe("row-0"));

    rerender({ sort: { field: "name", direction: "desc", nulls: "last" } });

    // The old order is still readable, and the view says it is stale.
    expect(result.current.rowAt(0)?.name).toBe("row-0");
    expect(result.current.isStale).toBe(true);

    await waitFor(() => expect(result.current.rowAt(0)?.name).toBe("row-999"));
    expect(result.current.isStale).toBe(false);
  });

  it("keeps the total with the rows it describes, not ahead of them", async () => {
    const h = makeHarness(1_000, true);

    const { result, rerender } = renderHook(
      ({ collapsed }: { collapsed: number[] }) =>
        useGridData(h.instance, { offset: 0, limit: PAGE }, null, collapsed, () => {}),
      { wrapper: h.wrapper, initialProps: { collapsed: [] as number[] } },
    );

    await waitFor(() => expect(result.current.total).toBe(1_000));

    rerender({ collapsed: [0] });

    // The old total belongs to the rows still on screen. A total that moved
    // first would size the scroll bar for rows the grid is not showing.
    expect(result.current.total).toBe(1_000);
    expect(result.current.rowAt(0)?.id).toBe(0);

    await waitFor(() => expect(result.current.total).toBe(940));
    expect(result.current.rowAt(0)?.id).toBe(GROUP_SIZE);
  });

  it("gives up the hold when the new view fails, rather than showing old rows for ever", async () => {
    const h = makeHarness(1_000);

    const { result, rerender } = renderHook(
      ({ sort }: { sort: SortSpec | null }) =>
        useGridData(h.instance, { offset: 0, limit: PAGE }, sort, [], () => {}),
      { wrapper: h.wrapper, initialProps: { sort: null as SortSpec | null } },
    );

    await waitFor(() => expect(result.current.rowAt(0)).toBeDefined());

    h.failFetchRows();
    rerender({ sort: { field: "name", direction: "desc", nulls: "last" } });

    await waitFor(() => expect(result.current.status).toBe("error"), { timeout: 10_000 });

    // The hold ends with the failure. Old rows under a permanent error hide the
    // banner and the retry behind data the user cannot act on.
    await waitFor(() => expect(result.current.isStale).toBe(false), { timeout: 10_000 });
    expect(result.current.rowAt(0)).toBeUndefined();
  });

  it("holds until the page the user LOOKS at lands, not the page above it", async () => {
    // `rangeForViewport` starts the window one page ABOVE the viewport, so for
    // any grid scrolled past the first page `range.offset` names a page nobody
    // can see. A gate on that page alone adopts while the visible page is still
    // in flight, and the whole viewport draws loading cells — the blank this
    // hold exists to remove. Every case at offset 0 misses it, because there
    // the page above the viewport IS the viewport's page.
    const h = makeHarness(1_000);

    const VISIBLE = 2 * PAGE;

    const { result, rerender } = renderHook(
      ({ sort }: { sort: SortSpec | null }) =>
        useGridData(h.instance, { offset: PAGE, limit: 3 * PAGE }, sort, [], () => {}),
      { wrapper: h.wrapper, initialProps: { sort: null as SortSpec | null } },
    );

    await waitFor(() => expect(result.current.rowAt(VISIBLE)?.id).toBe(VISIBLE));

    // Pages 1 and 3 of the new order may land; page 2, the one the viewport
    // shows, may not.
    h.holdPage(VISIBLE);
    rerender({ sort: { field: "id", direction: "desc", nulls: "last" } });

    for (let i = 0; i < 10; i += 1) {
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

      expect(result.current.isStale).toBe(true);
      expect(result.current.rowAt(VISIBLE)?.id).toBe(VISIBLE);
    }

    h.releasePage(VISIBLE);

    await waitFor(() => expect(result.current.isStale).toBe(false), { timeout: 10_000 });
    expect(result.current.rowAt(VISIBLE)?.id).toBe(999 - VISIBLE);
  });

  it("carries the pages above the collapse into the pending view", async () => {
    const h = makeHarness(1_000, true);

    const { result, rerender } = renderHook(
      ({ collapsed }: { collapsed: number[] }) =>
        useGridData(h.instance, { offset: 0, limit: PAGE }, null, collapsed, () => {}),
      { wrapper: h.wrapper, initialProps: { collapsed: [] as number[] } },
    );

    await waitFor(() => expect(result.current.rowAt(0)?.id).toBe(0));

    const requestsBefore = h.fetchRows.mock.calls.length;

    // Group 3 starts at row 180, so page 0 ends above it.
    h.instance.carryFromRef.current = 180;
    rerender({ collapsed: [3] });

    // No hold at all: the window sits inside the pages that carried over, and
    // not one request went out for them.
    expect(result.current.isStale).toBe(false);
    expect(result.current.rowAt(0)?.id).toBe(0);
    expect(result.current.rowAt(99)?.id).toBe(99);
    expect(h.fetchRows.mock.calls.length).toBe(requestsBefore);
  });

  it("drops the boundary when the user returns to the state on screen", async () => {
    const h = makeHarness(1_000, true);

    const { result, rerender } = renderHook(
      ({ collapsed, sort }: { collapsed: number[]; sort: SortSpec | null }) =>
        useGridData(h.instance, { offset: 300, limit: PAGE }, sort, collapsed, () => {}),
      {
        wrapper: h.wrapper,
        initialProps: { collapsed: [] as number[], sort: null as SortSpec | null },
      },
    );

    await waitFor(() => expect(result.current.rowAt(300)?.id).toBe(300));

    // Collapse group 10, then expand it again before the hold ends. The second
    // click writes its own boundary and opens NO pending view, because the state
    // key is back to the one on screen.
    h.instance.carryFromRef.current = 350;
    rerender({ collapsed: [10], sort: null });

    h.instance.carryFromRef.current = 700;
    rerender({ collapsed: [], sort: null });

    expect(h.instance.carryFromRef.current).toBeNull();

    // A sort moves every row. A boundary left over from the collapse would carry
    // page 3 into the new view, and the grid would draw the OLD order with no
    // dim and no request — the pages read `loaded`, so nobody asks again.
    rerender({ collapsed: [], sort: { field: "id", direction: "desc", nulls: "last" } });

    expect(result.current.isStale).toBe(true);
    expect(pendingStore(h).getRow(300)).toBeUndefined();
  });

  it("carries nothing across a sort, because a sort moves every row", async () => {
    const h = makeHarness(1_000);

    const { result, rerender } = renderHook(
      ({ sort }: { sort: SortSpec | null }) =>
        useGridData(h.instance, { offset: 0, limit: PAGE }, sort, [], () => {}),
      { wrapper: h.wrapper, initialProps: { sort: null as SortSpec | null } },
    );

    await waitFor(() => expect(result.current.rowAt(0)?.name).toBe("row-0"));

    // The click handler writes the boundary only for a collapse, so a sort
    // finds the cell null and the pending store starts empty.
    rerender({ sort: { field: "name", direction: "desc", nulls: "last" } });

    expect(result.current.isStale).toBe(true);
    expect(pendingStore(h).getRow(0)).toBeUndefined();
  });

  it("keeps the lower boundary when a second collapse lands during a hold", async () => {
    const h = makeHarness(1_000, true);

    const { result, rerender } = renderHook(
      ({ collapsed }: { collapsed: number[] }) =>
        useGridData(h.instance, { offset: 300, limit: PAGE }, null, collapsed, () => {}),
      { wrapper: h.wrapper, initialProps: { collapsed: [] as number[] } },
    );

    await waitFor(() => expect(result.current.rowAt(300)?.id).toBe(300));
    await waitFor(() => expect(result.current.rowAt(200)?.id).toBe(200));

    // The first collapse moves rows from 350, so page 2 carries and page 3 —
    // the window's own page — does not. The hold stays open on it.
    h.instance.carryFromRef.current = 350;
    rerender({ collapsed: [10] });

    expect(pendingStore(h).getRow(200)?.id).toBe(200);
    expect(pendingStore(h).getRow(300)).toBeUndefined();

    // The second collapse measures 600 against the SAME displayed store. Taking
    // it alone would carry page 3, whose rows the first collapse already moved.
    h.instance.carryFromRef.current = 600;
    rerender({ collapsed: [10, 2] });

    expect(pendingStore(h).getRow(300)).toBeUndefined();
    expect(pendingStore(h).getRow(200)?.id).toBe(200);
    expect(result.current.isStale).toBe(true);
  });

  it("holds the swap until the count describes the rows the swap brings on screen", async () => {
    const h = makeHarness(1_000, true);

    const { result, rerender } = renderHook(
      ({ collapsed }: { collapsed: number[] }) =>
        useGridData(h.instance, { offset: 0, limit: PAGE }, null, collapsed, () => {}),
      { wrapper: h.wrapper, initialProps: { collapsed: [] as number[] } },
    );

    await waitFor(() => expect(result.current.total).toBe(1_000));

    // Group 0 opens at row 0, so this collapse moves every row of the window
    // and nothing carries. The replacement rows land while the count is held.
    h.holdCount();
    h.instance.carryFromRef.current = 0;
    rerender({ collapsed: [0] });

    await waitFor(() => expect(pendingStore(h).getRow(0)?.id).toBe(GROUP_SIZE));

    // Those rows really did move, so they may not reach the screen under a
    // total that still counts the collapsed group.
    expect(result.current.isStale).toBe(true);
    expect(result.current.rowAt(0)?.id).toBe(0);

    h.releaseCount();

    await waitFor(() => expect(result.current.isStale).toBe(false));
    expect(result.current.rowAt(0)?.id).toBe(GROUP_SIZE);
    expect(result.current.total).toBe(940);
  });

  it("never publishes a total of 0 while the count of a carried view is in flight", async () => {
    const h = makeHarness(1_000, true);

    const { result, rerender } = renderHook(
      ({ collapsed }: { collapsed: number[] }) =>
        useGridData(h.instance, { offset: 0, limit: PAGE }, null, collapsed, () => {}),
      { wrapper: h.wrapper, initialProps: { collapsed: [] as number[] } },
    );

    await waitFor(() => expect(result.current.total).toBe(1_000));

    h.holdCount();
    h.instance.carryFromRef.current = 180;
    rerender({ collapsed: [3] });

    // The pages carried, so the rows are ready one render after the click. The
    // count is not, and a total of 0 would empty a grid whose rows are all
    // there.
    expect(result.current.isStale).toBe(false);
    expect(result.current.rowAt(0)?.id).toBe(0);
    expect(result.current.total).toBe(1_000);

    h.releaseCount();

    await waitFor(() => expect(result.current.total).toBe(940));
    expect(result.current.rowAt(0)?.id).toBe(0);
  });

  it("ends the hold on a rejected count and keeps the total it can still prove", async () => {
    const h = makeHarness(1_000, true);

    const { result, rerender } = renderHook(
      ({ collapsed }: { collapsed: number[] }) =>
        useGridData(h.instance, { offset: 0, limit: PAGE }, null, collapsed, () => {}),
      { wrapper: h.wrapper, initialProps: { collapsed: [] as number[] } },
    );

    await waitFor(() => expect(result.current.total).toBe(1_000));

    // Nothing carries, so the swap has to pass the count gate. The count for the
    // new collapse set never returns a number.
    h.failCount();
    h.instance.carryFromRef.current = 0;
    rerender({ collapsed: [0] });

    // The hold ends. Old rows under a count that will never land hide the grid
    // behind data the user cannot act on.
    await waitFor(() => expect(result.current.isStale).toBe(false));
    expect(result.current.rowAt(0)?.id).toBe(GROUP_SIZE);

    // And the total stays the last number the grid could prove. A rejected
    // count carries no number, and publishing its 0 empties a grid whose rows
    // are all on screen — with no banner, because `status` speaks for pages.
    expect(result.current.total).toBe(1_000);
  });
});
