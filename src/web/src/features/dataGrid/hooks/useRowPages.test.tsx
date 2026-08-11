import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createRowStore } from "../data/rowStore";
import type { SortSpec } from "../data/sortSpec";
import { createFakeRowServer } from "../testing/fakeRowServer";
import type { GridDescriptor } from "../types";
import { MAX_CONCURRENT_PAGES, useRowPages } from "./useRowPages";

interface Row {
  id: number;
  name: string;
}

const PAGE = 100;

const DESC_BY_NAME: SortSpec = { field: "name", direction: "desc", nulls: "last" };

function makeHarness(total: number) {
  const server = createFakeRowServer<Row, number, number>({
    rows: Array.from({ length: total }, (_, i) => ({ id: i, name: `row-${i}` })),
    rowKey: (r) => r.id,
  });

  let openFetch: () => void = () => {};
  let fetchGate: Promise<void> = Promise.resolve();
  let failNext = false;

  const fetchRows = vi.fn(async (p: Parameters<typeof server.api.fetchRows>[0]) => {
    await fetchGate;

    if (failNext) {
      failNext = false;
      throw new Error("boom");
    }

    return server.api.fetchRows(p);
  });

  const descriptor = {
    name: "pages",
    rowKey: (r: Row) => r.id,
    pageSize: PAGE,
    columns: { defs: {}, defaultOrder: [] },
    api: { ...server.api, fetchRows },
    cells: { makeCell: () => ({}), customRenderers: [], validateCell: () => true },
  } as unknown as GridDescriptor<Row, number, number>;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    descriptor,
    fetchRows,
    wrapper,
    holdFetch() {
      fetchGate = new Promise<void>((resolve) => {
        openFetch = resolve;
      });
    },
    releaseFetch() {
      openFetch();
    },
    failNextFetch() {
      failNext = true;
    },
    requested() {
      return fetchRows.mock.calls.map((c) => ({ offset: c[0].offset, limit: c[0].limit }));
    },
  };
}

describe("useRowPages", () => {
  it("loads the pages a window touches, and asks for a narrow slice", async () => {
    const h = makeHarness(1_000_000);
    const store = createRowStore<Row, number>(PAGE, (r) => r.id);
    const onRowsLoaded = vi.fn();

    renderHook(
      () =>
        useRowPages({
          descriptor: h.descriptor,
          store,
          range: { offset: 999_700, limit: 300 },
          sort: null,
          collapsedGroups: [],
          onRowsLoaded,
        }),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(store.getRow(999_700)).toBeDefined());

    expect(h.requested()).toEqual([
      { offset: 999_700, limit: PAGE },
      { offset: 999_800, limit: PAGE },
      { offset: 999_900, limit: PAGE },
    ]);
    expect(store.getRow(999_999)?.name).toBe("row-999999");
  });

  it("issues a whole grouped window in one round of requests", async () => {
    // The widest window the grid builds: `rangeForViewport` takes the pages a
    // viewport spans plus one either side, and `widenedForPrecedingGroup` adds
    // one more below a grouped window. A cap under that number is not wrong,
    // but it costs the leftover pages a full extra round trip on every jump.
    const h = makeHarness(1_000_000);
    const store = createRowStore<Row, number>(PAGE, (r) => r.id);

    const viewportPages = 2;
    const windowPages = viewportPages + 3;

    expect(MAX_CONCURRENT_PAGES).toBeGreaterThanOrEqual(windowPages);

    h.holdFetch();

    renderHook(
      () =>
        useRowPages({
          descriptor: h.descriptor,
          store,
          range: { offset: 500_000, limit: windowPages * PAGE },
          sort: null,
          collapsedGroups: [],
          onRowsLoaded: () => {},
        }),
      { wrapper: h.wrapper },
    );

    // Every page is asked for while the gate is still shut, so they are all in
    // flight together rather than queued behind one another.
    await waitFor(() => expect(h.requested()).toHaveLength(windowPages));

    h.releaseFetch();

    await waitFor(() => expect(store.getRow(500_000 + windowPages * PAGE - 1)).toBeDefined());
  });

  it("reports the loaded indexes so the caller can damage exactly those cells", async () => {
    const h = makeHarness(1_000);
    const store = createRowStore<Row, number>(PAGE, (r) => r.id);
    const onRowsLoaded = vi.fn();

    renderHook(
      () =>
        useRowPages({
          descriptor: h.descriptor,
          store,
          range: { offset: 0, limit: PAGE },
          sort: null,
          collapsedGroups: [],
          onRowsLoaded,
        }),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(onRowsLoaded).toHaveBeenCalled());

    const indexes = onRowsLoaded.mock.calls[0][0] as number[];

    expect(indexes[0]).toBe(0);
    expect(indexes).toHaveLength(PAGE);
  });

  it("never asks for a page it already holds", async () => {
    const h = makeHarness(1_000);
    const store = createRowStore<Row, number>(PAGE, (r) => r.id);

    const { rerender } = renderHook(
      ({ offset }: { offset: number }) =>
        useRowPages({
          descriptor: h.descriptor,
          store,
          range: { offset, limit: PAGE },
          sort: null,
          collapsedGroups: [],
          onRowsLoaded: () => {},
        }),
      { wrapper: h.wrapper, initialProps: { offset: 0 } },
    );

    await waitFor(() => expect(store.getRow(0)).toBeDefined());

    rerender({ offset: 100 });
    await waitFor(() => expect(store.getRow(100)).toBeDefined());

    rerender({ offset: 0 });

    // A settle window long enough for a wrong second request to appear.
    await act(() => new Promise((r) => setTimeout(r, 60)));

    expect(h.requested()).toEqual([
      { offset: 0, limit: PAGE },
      { offset: 100, limit: PAGE },
    ]);
  });

  it("keeps the rows it already holds while the next window loads — no flash", async () => {
    const h = makeHarness(10_000);
    const store = createRowStore<Row, number>(PAGE, (r) => r.id);

    const { rerender } = renderHook(
      ({ offset }: { offset: number }) =>
        useRowPages({
          descriptor: h.descriptor,
          store,
          range: { offset, limit: PAGE },
          sort: null,
          collapsedGroups: [],
          onRowsLoaded: () => {},
        }),
      { wrapper: h.wrapper, initialProps: { offset: 0 } },
    );

    await waitFor(() => expect(store.getRow(0)).toBeDefined());

    h.holdFetch();
    rerender({ offset: 100 });

    // THE HEADLINE ASSERTION. The next window is mid-flight and rows 0-99 are
    // still there. Under the collection-per-window design they were gone.
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(store.getRow(0)?.name).toBe("row-0");
    expect(store.getRow(99)?.name).toBe("row-99");

    h.releaseFetch();
    await waitFor(() => expect(store.getRow(100)).toBeDefined());
    expect(store.getRow(0)?.name).toBe("row-0");
  });

  it("reissues a page whose load was discarded mid-flight, instead of leaving it loading forever", async () => {
    const h = makeHarness(10_000);
    const store = createRowStore<Row, number>(PAGE, (r) => r.id);

    h.holdFetch();

    const { rerender } = renderHook(
      ({ sort }: { sort: SortSpec | null }) =>
        useRowPages({
          descriptor: h.descriptor,
          store,
          range: { offset: 0, limit: PAGE },
          sort,
          collapsedGroups: [],
          onRowsLoaded: () => {},
        }),
      { wrapper: h.wrapper, initialProps: { sort: null as SortSpec | null } },
    );

    await waitFor(() => expect(h.requested()).toEqual([{ offset: 0, limit: PAGE }]));

    // Sort by another column. Page 0's still-pending load answers for an order
    // the grid no longer shows, so its result is discarded when it lands. The
    // page reads "loading" until then, so this render asks for nothing new.
    rerender({ sort: DESC_BY_NAME });
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(h.requested()).toHaveLength(1);

    // The blocked fetch settles now. It abandons page 0, and it must still
    // nudge the hook to notice: nothing else will ever ask again on its own,
    // and a page left "loading" is a page the loader skips for ever.
    h.releaseFetch();

    await waitFor(() => expect(h.requested()).toHaveLength(2));
    await waitFor(() => expect(store.pageState(0)).toBe("loaded"));

    // The reissue carries the order the grid actually shows now.
    expect(h.fetchRows.mock.calls[1][0].sort).toEqual(DESC_BY_NAME);
  });

  it("keeps a page whose window moved while it was in flight, and never re-requests it", async () => {
    // The regression this guards: the load effect re-runs whenever the window
    // moves or a page settles, and it used to CANCEL the pages in flight when
    // it did. Each cancelled page went back to "missing" and settled, which
    // re-ran the effect and cancelled the next one — so a window of two pages
    // re-requested the same two pages for as long as the grid stayed open, and
    // not one of them was ever written.
    const h = makeHarness(10_000);
    const store = createRowStore<Row, number>(PAGE, (r) => r.id);

    h.holdFetch();

    const { rerender } = renderHook(
      ({ limit }: { limit: number }) =>
        useRowPages({
          descriptor: h.descriptor,
          store,
          range: { offset: 0, limit },
          sort: null,
          collapsedGroups: [],
          onRowsLoaded: () => {},
        }),
      { wrapper: h.wrapper, initialProps: { limit: PAGE } },
    );

    await waitFor(() => expect(h.requested()).toEqual([{ offset: 0, limit: PAGE }]));

    // The window widens onto a second page while the first is still in flight —
    // exactly what glide's first visible-region callback does on mount.
    rerender({ limit: 2 * PAGE });
    await waitFor(() => expect(h.requested()).toHaveLength(2));

    h.releaseFetch();

    await waitFor(() => expect(store.getRow(0)?.name).toBe("row-0"));
    await waitFor(() => expect(store.getRow(100)?.name).toBe("row-100"));

    // Settled, and settled for good: one request per page, and no further
    // request after the store went quiet.
    await act(() => new Promise((r) => setTimeout(r, 80)));

    expect(h.requested()).toEqual([
      { offset: 0, limit: PAGE },
      { offset: 100, limit: PAGE },
    ]);
  });

  it("reports loading only while the window holds no rows at all", async () => {
    const h = makeHarness(1_000);
    const store = createRowStore<Row, number>(PAGE, (r) => r.id);

    const { result } = renderHook(
      () =>
        useRowPages({
          descriptor: h.descriptor,
          store,
          range: { offset: 0, limit: PAGE },
          sort: null,
          collapsedGroups: [],
          onRowsLoaded: () => {},
        }),
      { wrapper: h.wrapper },
    );

    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("reports an error when a page the window needs fails", async () => {
    const h = makeHarness(1_000);
    const store = createRowStore<Row, number>(PAGE, (r) => r.id);
    h.failNextFetch();

    const { result } = renderHook(
      () =>
        useRowPages({
          descriptor: h.descriptor,
          store,
          range: { offset: 0, limit: PAGE },
          sort: null,
          collapsedGroups: [],
          onRowsLoaded: () => {},
        }),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(store.pageState(0)).toBe("failed");
  });

  it("reloads a failed page on retry", async () => {
    const h = makeHarness(1_000);
    const store = createRowStore<Row, number>(PAGE, (r) => r.id);
    h.failNextFetch();

    const { result } = renderHook(
      () =>
        useRowPages({
          descriptor: h.descriptor,
          store,
          range: { offset: 0, limit: PAGE },
          sort: null,
          collapsedGroups: [],
          onRowsLoaded: () => {},
        }),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(store.getRow(0)?.name).toBe("row-0");
  });

  it("sends the sort and the collapse set to the server", async () => {
    const h = makeHarness(1_000);
    const store = createRowStore<Row, number>(PAGE, (r) => r.id);

    renderHook(
      () =>
        useRowPages({
          descriptor: h.descriptor,
          store,
          range: { offset: 0, limit: PAGE },
          sort: { field: "name", direction: "desc", nulls: "last" },
          collapsedGroups: [2],
          onRowsLoaded: () => {},
        }),
      { wrapper: h.wrapper },
    );

    await waitFor(() => expect(h.fetchRows).toHaveBeenCalled());

    const call = h.fetchRows.mock.calls[0][0];

    expect(call.sort).toEqual({ field: "name", direction: "desc", nulls: "last" });
    expect(call.collapsedGroups).toEqual([2]);
  });
});
