import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RowStore } from "../data/rowStore";
import type { SortSpec } from "../data/sortSpec";
import type { GridDescriptor } from "../types";
import type { WindowRange } from "./useWindowRange";

/**
 * How many page requests may be in flight at once.
 *
 * The number a window needs follows from two places, and both add to it:
 *
 * - `rangeForViewport` takes the pages the viewport touches plus one either
 *   side, so a viewport spanning N pages asks for N + 2.
 * - `widenedForPrecedingGroup` adds one more below a GROUPED window, for the
 *   row whose group key the span reads.
 *
 * So a grouped grid wants N + 3. A viewport spans two pages whenever it
 * straddles a page boundary, which at the default page size of 100 is most of
 * the time, and three only at a viewport height no screen has. Six therefore
 * loads a whole window in one round of requests, with a page of headroom, and
 * still stops a fast scroll opening an unbounded number of sockets.
 *
 * A cap BELOW the window size is not a correctness problem — the leftover pages
 * simply go in a second round — but it costs those pages a full extra round
 * trip, and at 4 that penalty landed on nearly every jump.
 */
export const MAX_CONCURRENT_PAGES = 6;

/**
 * Every cached page of one grid sits under this prefix, so anything that has to
 * drop a grid's rows in one call cannot drift from the key that builds on it.
 */
export function rowsKeyPrefix(name: string): readonly unknown[] {
  return [name, "page"];
}

/**
 * The cache key of one page.
 *
 * The sort and the collapse set are IN the key, not beside it. Both change
 * which rows sit at a given offset, so a page fetched under one must never be
 * served under another.
 */
export function rowPagesKey(
  name: string,
  page: number,
  sort: SortSpec | null,
  collapsedGroups: unknown[],
): readonly unknown[] {
  return [...rowsKeyPrefix(name), page, sort, [...collapsedGroups].sort()];
}

export interface UseRowPagesArgs<TRow extends object, TGroup, TKey extends string | number> {
  descriptor: GridDescriptor<TRow, TGroup, TKey>;
  store: RowStore<TRow, TKey>;
  range: WindowRange;
  sort: SortSpec | null;
  collapsedGroups: TGroup[];

  /**
   * Called with the absolute indexes a page load wrote. The caller turns them
   * into a glide damage list. This is the ONLY way a load reaches the screen —
   * the hook stores no rows in React state, so no load re-renders the grid.
   */
  onRowsLoaded: (indexes: number[]) => void;

  /**
   * The range `status` reports on. Defaults to `range`.
   *
   * A caller may widen `range` to fetch a page outside the visible window —
   * `hooks/useGridData.ts` does this to load the row just above a grouped
   * window, purely so `spanFromStore` can read that row's group. That extra
   * page is not on screen, so its own failure or success must never change
   * what the user sees reported: pass the narrower, un-widened range here and
   * a failed page nobody can see can neither hide behind a healthy extra page
   * nor manufacture an error over rows that loaded fine.
   */
  statusRange?: WindowRange;
}

export interface UseRowPagesResult {
  status: "loading" | "ready" | "error";

  /**
   * Counts page settlements. It names no page and carries no row, so nothing
   * about a row's VALUE reaches React through it.
   *
   * A caller that reads the store through a `useMemo` must key that memo on
   * this rather than on `status`. `status` reads "ready" the moment the FIRST
   * page of a window lands and never moves again while the rest of that
   * window arrives, so a memo keyed on it freezes at one page.
   */
  settled: number;

  /** Clears the failed pages of the current window and loads them again. */
  retry: () => void;
}

/**
 * Fills the row store for whatever window is current.
 *
 * The design rule is that ROWS NEVER ENTER REACT STATE. A page lands, the store
 * takes it, and `onRowsLoaded` damages those cells. React re-renders only when
 * the status changes, and the status is three strings.
 *
 * That is what removes the flash. The old collection-per-window design put the
 * rows behind a live query keyed on collection identity, so a window move
 * handed the renderer an empty result and every visible cell fell back to
 * `GridCellKind.Loading` until the fetch landed. Here a window move loads the
 * pages it lacks and touches nothing the store already holds.
 */
export function useRowPages<TRow extends object, TGroup, TKey extends string | number>({
  descriptor,
  store,
  range,
  statusRange = range,
  sort,
  collapsedGroups,
  onRowsLoaded,
}: UseRowPagesArgs<TRow, TGroup, TKey>): UseRowPagesResult {
  const queryClient = useQueryClient();

  // Bumped whenever a page settles, which is what re-runs the status read
  // below. It counts settlements rather than naming one, so nothing about a
  // row's VALUE reaches React through it.
  const [settled, setSettled] = useState(0);

  // The callback is read through a ref so a caller may pass a fresh closure per
  // render without re-running the load effect and re-requesting every page.
  const onRowsLoadedRef = useRef(onRowsLoaded);
  onRowsLoadedRef.current = onRowsLoaded;

  const pages = pagesInRange(range, store.pageSize);
  const pagesKey = pages.join(",");
  const stateKey = JSON.stringify([sort, [...collapsedGroups].sort()]);

  // Read at WRITE time by a page load that started one or more renders ago, so
  // it can tell whether the order it fetched under is still the order on
  // screen. It is a ref rather than a closure over `stateKey` because the load
  // needs the CURRENT value, not the value of the render that started it.
  const stateKeyRef = useRef(stateKey);
  stateKeyRef.current = stateKey;

  // `statusOf` reads THIS set, never `pages`. `pages` is what gets fetched —
  // it may hold a page outside the visible window — and `status` must speak
  // only for what the window actually shows.
  const statusPages = pagesInRange(statusRange, store.pageSize);

  // What an in-flight page load reads to tell whether its result is still
  // wanted. A load reaches back for it rather than closing over a flag of the
  // effect that started it, because the two are invalidated by DIFFERENT
  // things — see the epoch effect below.
  const epochRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // THE EPOCH. A page fetched for one store under one sort and collapse set is
  // worthless to any other, and worthless after an unmount; it is worth exactly
  // as much as ever to a window that has since moved, because a moved window
  // changes no row's position and the store caps and evicts its own pages.
  //
  // So the flag that discards a result belongs to a hook-lifetime effect keyed
  // on the store and the state key ALONE, never on the window or the settle
  // counter. Tying it to the load effect below — which re-runs on both — is what
  // made the loader unable to converge: every settle tore that effect down,
  // cancelling the pages still in flight; each cancelled page went back to
  // "missing" and settled, which tore the effect down again. With two pages in a
  // window the two took turns cancelling each other and NO page was ever
  // written, so the grid re-requested the same two pages for as long as it
  // stayed open.
  useEffect(() => {
    const epoch = { cancelled: false };
    epochRef.current = epoch;

    return () => {
      epoch.cancelled = true;
    };
  }, [store, stateKey]);

  useEffect(() => {
    const epoch = epochRef.current;

    const run = async () => {
      for (const chunk of chunked(pages, MAX_CONCURRENT_PAGES)) {
        if (epoch.cancelled) {
          return;
        }

        const wanted = chunk.filter((page) => store.pageState(page) === "missing");

        if (wanted.length === 0) {
          continue;
        }

        await Promise.all(
          wanted.map((page) =>
            loadPage({
              queryClient,
              descriptor,
              store,
              page,
              sort,
              collapsedGroups,
              stateKey,
              currentStateKey: () => stateKeyRef.current,
              isCancelled: () => epoch.cancelled,
              onRowsLoaded: (indexes) => onRowsLoadedRef.current(indexes),
              onSettled: () => setSettled((n) => n + 1),
            }),
          ),
        );
      }
    };

    void run();

    // No cleanup. This effect only STARTS loads; what makes one worthless is
    // the epoch above, and a re-run here means the window moved or a page
    // settled — neither of which invalidates a fetch already in the air.
    // `pagesKey` and `stateKey` stand in for the arrays they describe, so a
    // caller that rebuilds `collapsedGroups` per render does not re-request
    // every page. `settled` re-runs the effect after a retry clears a page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey, stateKey, store, descriptor, queryClient, settled]);

  const retry = useCallback(() => {
    for (const page of pages) {
      if (store.pageState(page) === "failed") {
        queryClient.removeQueries({
          queryKey: rowPagesKey(descriptor.name, page, sort, collapsedGroups),
        });

        store.markMissing(page);
      }
    }

    setSettled((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey, stateKey, store, descriptor, queryClient]);

  return { status: statusOf(store, statusPages), settled, retry };
}

/** Every page an inclusive window touches. */
function pagesInRange(range: WindowRange, pageSize: number): number[] {
  const first = Math.floor(range.offset / pageSize);
  const last = Math.floor(Math.max(range.offset, range.offset + range.limit - 1) / pageSize);

  const pages: number[] = [];

  for (let page = first; page <= last; page += 1) {
    pages.push(page);
  }

  return pages;
}

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

/**
 * A window that holds no rows and has a failed page reads as an error. A window
 * that holds SOME rows never does: the loading cells already speak for the rest,
 * and a banner over rows the user can read says the grid is broken when it is
 * not.
 */
function statusOf<TRow extends object, TKey extends string | number>(
  store: RowStore<TRow, TKey>,
  pages: number[],
): "loading" | "ready" | "error" {
  const anyLoaded = pages.some((page) => store.pageState(page) === "loaded");

  if (anyLoaded) {
    return "ready";
  }

  if (pages.some((page) => store.pageState(page) === "failed")) {
    return "error";
  }

  return "loading";
}

async function loadPage<TRow extends object, TGroup, TKey extends string | number>({
  queryClient,
  descriptor,
  store,
  page,
  sort,
  collapsedGroups,
  stateKey,
  currentStateKey,
  isCancelled,
  onRowsLoaded,
  onSettled,
}: {
  queryClient: QueryClient;
  descriptor: GridDescriptor<TRow, TGroup, TKey>;
  store: RowStore<TRow, TKey>;
  page: number;
  sort: SortSpec | null;
  collapsedGroups: TGroup[];
  stateKey: string;
  currentStateKey: () => string;
  isCancelled: () => boolean;
  onRowsLoaded: (indexes: number[]) => void;
  onSettled: () => void;
}): Promise<void> {
  /**
   * Whether this run's result must be discarded rather than written.
   *
   * Two separate things invalidate it, and neither implies the other:
   *
   * - `isCancelled` — the EPOCH this run belongs to ended: the hook unmounted,
   *   or it was handed a different store.
   * - the sort or the collapse set moved while the request was in flight, so
   *   the rows coming back answer for an order the grid no longer shows.
   *   Writing them would seat old-order rows at indexes the new order owns.
   *
   * A WINDOW MOVE is deliberately absent from that list. The rows coming back
   * sit at the same indexes in the same store whether or not the user has
   * scrolled since, so a moved window makes them no less true; the store's own
   * page cap decides whether they are worth keeping. Discarding them here
   * instead threw away a completed round trip AND, through the settle bump in
   * `finally`, asked for the very same page again.
   */
  const mustDiscard = () => isCancelled() || currentStateKey() !== stateKey;

  store.markLoading(page);

  try {
    const rows = await queryClient.fetchQuery({
      queryKey: rowPagesKey(descriptor.name, page, sort, collapsedGroups),
      queryFn: ({ signal }) =>
        descriptor.api.fetchRows({
          offset: page * store.pageSize,
          limit: store.pageSize,
          sort,
          collapsedGroups,
          signal,
        }),
    });

    // The epoch ended, or the state key moved, while this was in flight.
    // Writing now would put rows fetched under the OLD sort into a store the new
    // one owns. The page must not stay "loading" forever,
    // either: nothing else will ever move it out of that state, and the loader
    // only re-requests a page whose state is "missing". Put it back to missing,
    // and drop the query-cache entry along with it, or a later window's
    // `fetchQuery` for this same key would be served this stale response
    // straight from cache instead of ever calling `queryFn` again.
    if (mustDiscard()) {
      abandon({ queryClient, descriptor, page, sort, collapsedGroups, store });
      return;
    }

    onRowsLoaded(store.writePage(page, rows));
  } catch {
    if (mustDiscard()) {
      abandon({ queryClient, descriptor, page, sort, collapsedGroups, store });
      return;
    }

    // Swallowed on purpose. The page state carries the failure and
    // `GridStatusBar` shows it; re-throwing here would surface as an unhandled
    // rejection from an effect nobody awaits.
    store.markFailed(page);
  } finally {
    // Called even when this run was discarded. `abandon()` above just put the
    // page back to "missing", and a settle bump is the ONLY thing that makes
    // the hook re-check: nothing else re-runs the load effect when a window
    // parked on that exact page never itself changes. Without this, a page
    // whose in-flight fetch is discarded — the sort moved away and straight
    // back, say — starves forever: "missing", with nobody asking again.
    //
    // This cannot spin, and the distinction matters, because for one release it
    // did. A settle bump re-runs the load effect, and that effect only calls
    // `loadPage` for a page whose state reads "missing" at that moment. A page
    // that just loaded, failed, or was abandoned is no longer in that state (or
    // was put back into it on purpose), so a re-run finds nothing left to fetch
    // and terminates without settling again. What broke that argument was the
    // re-run also CANCELLING the pages still in flight: each cancellation put
    // one back to "missing" and settled, which cancelled the next one, so two
    // pages in a window kept each other missing for ever. The epoch keeps the
    // re-run from cancelling anything, which is what makes the argument hold.
    onSettled();
  }
}

/**
 * Undoes a page load that landed after its own effect was cancelled: the
 * store is put back to "missing" so a later window can ask for it again, and
 * the query-cache entry is dropped so that request actually reaches the
 * network instead of being served this abandoned response from cache.
 *
 * Never call this for a page that was actually written — only for a page
 * whose result this run is discarding.
 */
function abandon<TRow extends object, TGroup, TKey extends string | number>({
  queryClient,
  descriptor,
  page,
  sort,
  collapsedGroups,
  store,
}: {
  queryClient: QueryClient;
  descriptor: GridDescriptor<TRow, TGroup, TKey>;
  page: number;
  sort: SortSpec | null;
  collapsedGroups: TGroup[];
  store: RowStore<TRow, TKey>;
}): void {
  queryClient.removeQueries({
    queryKey: rowPagesKey(descriptor.name, page, sort, collapsedGroups),
  });

  store.markMissing(page);
}
