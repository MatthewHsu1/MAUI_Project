import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createEditOverlay, type EditOverlay } from "../data/editOverlay";
import { useRowCount } from "../data/rowCount";
import { carryPagesBefore, createRowStore, type RowStore } from "../data/rowStore";
import type { SortSpec } from "../data/sortSpec";
import { spanFromStore, type LoadedSpan } from "../data/spanFromStore";
import type { GridDescriptor, GridGrouping } from "../types";
import { useRowPages } from "./useRowPages";
import type { RangeLoaded, WindowRange } from "./useWindowRange";

/**
 * The minimal shape this hook reads off a grid instance. `GridInstance`
 * satisfies it structurally, which keeps the hook free of Redux and testable
 * against a bare object.
 */
export interface GridDataSource<TRow extends object, TGroup, TKey extends string | number> {
  /** What to fetch and how: the API, the page size, the row key, the grouping. */
  descriptor: GridDescriptor<TRow, TGroup, TKey>;

  /**
   * Where this hook PUBLISHES the displayed store, for the push subscriber to
   * find.
   *
   * A cell rather than a value, because the instance is created once at module
   * scope while a store belongs to whichever grid is mounted. It reads null
   * before the first mount, and a push that arrives then is dropped.
   */
  storeRef: { current: RowStore<TRow, TKey> | null };

  /**
   * The same, for the store a hold is filling. Null outside a hold.
   *
   * A push has to maintain BOTH: a patch that reached only the displayed store
   * would be discarded by the very next adoption.
   */
  pendingStoreRef: { current: RowStore<TRow, TKey> | null };

  /**
   * The first data index the collapse change now landing moves, or null when
   * everything moves.
   *
   * The header click writes it, because only the display model knows where a
   * group's rows begin, and this hook reads it ONCE and clears it. Everything
   * above that index sits at the same data index under both collapse sets, so
   * those pages move into the new store instead of being fetched again.
   */
  carryFromRef: { current: number | null };

  // The read path SUBSCRIBES to invalidations; it never raises one.
  // `bumpDataGeneration` is deliberately absent from this shape, so nothing
  // reachable from here can invalidate the rows it is reading.

  /** Registers a listener for that counter and answers with the unsubscribe. */
  subscribeDataGeneration: (listener: () => void) => () => void;

  /**
   * The grid's data generation: which SET OF ROWS the server is offering.
   *
   * A pushed create or delete bumps it, because both move every position after
   * them, exactly as a sort or a collapse change does.
   */
  getDataGeneration: () => number;
}

export interface UseGridDataResult<TRow extends object, TGroup, TKey extends string | number> {
  /** The row at a data index, with any in-flight edit of it laid over the top. */
  rowAt: (dataIndex: number) => TRow | undefined;

  /** Whether a row has a save in flight. Drives the grey cell text. */
  isPending: (key: TKey) => boolean;

  /**
   * Whether committing a candidate window would start no request.
   *
   * `useWindowRange` reads it to decide whether that window pays the settle
   * wait. Rows already in the store commit at once; a window that would fetch
   * waits for the scroll to stop.
   */
  isRangeLoaded: RangeLoaded;

  /** How many rows the view on screen holds. Glide sizes its scroll bar from it. */
  total: number;

  /** The loaded rows at the current window, for the display model to place headers from. */
  span: LoadedSpan<TRow, TGroup>;

  /**
   * What the VISIBLE window is doing. It reads "ready" as soon as the FIRST
   * page of that window lands, so it answers "is there anything to draw", never
   * "is every row here".
   */
  status: "loading" | "ready" | "error";

  /** Loads the failed pages of the current window again. The error banner's button. */
  retry: () => void;

  /**
   * True while the grid draws the PREVIOUS sort or collapse state because the
   * next one has not loaded. The rows on screen are real and internally
   * consistent; they are simply one state behind.
   */
  isStale: boolean;

  /**
   * The store the grid is drawing now. It is a DIFFERENT object after every
   * adoption, so a caller that outlives one — the settle path of a save — must
   * re-read it rather than capture it.
   */
  store: RowStore<TRow, TKey>;

  /**
   * The optimistic edits, keyed by row key. One overlay serves both views and
   * survives every swap, so an edit begun on the held rows still settles.
   */
  overlay: EditOverlay<TRow, TKey>;
}

/**
 * One state of the grid, whole. The rows, the total, and the key they were
 * fetched under travel together, so nothing on screen can describe two states
 * at once.
 */
interface ViewState<TRow extends object, TKey extends string | number> {
  /** The sort, the collapse set, and the data generation these rows answer for. */
  stateKey: string;

  /** This state's rows alone. A view never borrows a row from the other one. */
  store: RowStore<TRow, TKey>;

  /**
   * The count that belongs to those rows. It moves only while nothing is
   * pending, so the scroll bar never sizes for rows the grid is not showing.
   */
  total: number;

  /**
   * The first index the change INTO this state moves, or null when it moves
   * everything. Kept for two readers: a SECOND change during the same hold
   * bounds itself by it, and the swap reads it to tell whether the window on
   * screen moved at all.
   */
  carriedFrom: number | null;
}

/**
 * How far up the store two changes agree, or null when they do not.
 *
 * `boundary` belongs to the change just made. `previous` is a hold already
 * running. Both measure against the SAME displayed store, so the LOWER boundary
 * bounds the rows that neither change moves. A null on either side means
 * "everything moved", and nothing carries.
 */
function carryBoundary<TRow extends object, TKey extends string | number>(
  boundary: number | null,
  previous: ViewState<TRow, TKey> | null,
): number | null {
  if (boundary === null) {
    return null;
  }

  if (previous === null) {
    return boundary;
  }

  if (previous.carriedFrom === null) {
    return null;
  }

  return Math.min(boundary, previous.carriedFrom);
}

/**
 * The grid's read path, composed.
 *
 * A store OUTLIVES every window move. That single fact removed the first flash:
 * the old design built a collection per window, so a window move handed the
 * renderer an empty result. A window move changes no row's position, so this
 * hook clears nothing and re-reads nothing.
 *
 * A sort change, a collapse change, or a pushed create or delete DOES move every
 * row, so the rows loaded under the old state are all wrong. Clearing the store
 * in place answered that, and it was correct — but it blanked the grid for a
 * whole round trip. This hook holds TWO view states instead: the displayed one
 * stays on screen, dimmed, while the pending one fills up behind it, and they
 * swap in a single render so the rows, the total, and the span never describe
 * two states at once.
 *
 * A COLLAPSE change is the one that does not move every row. It moves the rows
 * at and below one group, and the header click leaves the index of that group's
 * first row in `carryFromRef`. The pages that end above it hold the same rows at
 * the same indexes under both collapse sets, so they move straight into the new
 * store. Collapsing a group the user is not looking at then costs one count
 * request and no page request, and the swap repaints nothing.
 *
 * Memory stays bounded because each store carries its own `MAX_LOADED_PAGES`
 * cap and at most two are REACHABLE from the hook: a second state key replaces
 * the pending view rather than adding to it, and adoption drops the old one. A
 * burst of pushes during one hold therefore costs two stores, not one per push.
 * A dropped store outlives the drop while its own fetches are still in flight,
 * because the `loadPage` closures hold it — one transient store per abandoned
 * state key, each freed within a round trip.
 */
export function useGridData<TRow extends object, TGroup, TKey extends string | number>(
  instance: GridDataSource<TRow, TGroup, TKey>,
  range: WindowRange,
  sort: SortSpec | null,
  collapsedGroups: TGroup[],
  onRowsLoaded: (indexes: number[]) => void,
): UseGridDataResult<TRow, TGroup, TKey> {
  const { descriptor } = instance;
  const pageSize = descriptor.pageSize ?? 100;

  const overlayRef = useRef<EditOverlay<TRow, TKey> | null>(null);
  overlayRef.current ??= createEditOverlay<TRow, TKey>();
  const overlay = overlayRef.current;

  const generation = useSyncExternalStore(
    instance.subscribeDataGeneration,
    instance.getDataGeneration,
    instance.getDataGeneration,
  );

  // One value for "which rows sit where". Any of the three moving moves every
  // row, so a view is only ever named by all three together.
  //
  // The generation joins the sort and the collapse set because a create or a
  // delete changes which row sits at a given index just as they do. One key,
  // one store, one hold — a push now takes the same path a sort does, and the
  // rows on screen stay there while the replacement loads behind them.
  const stateKey = JSON.stringify([sort, [...collapsedGroups].sort(), generation]);

  const newStore = () => createRowStore<TRow, TKey>(pageSize, descriptor.rowKey);

  const { displayed, pending, adoptions, adopt } = useViewPair<TRow, TKey>(
    stateKey,

    // The first view of the grid. Nothing precedes it, so it carries nothing.
    (key) => ({ stateKey: key, store: newStore(), total: 0, carriedFrom: null }),

    // Every view after it. A collapse moves the rows AT AND BELOW one group, so
    // the pages that end above it hold the same rows at the same indexes under
    // both collapse sets and move straight into the new store. A window sitting
    // wholly above the group then costs one count request and no page request.
    (key, from, holding) => {
      const store = newStore();
      const carriedFrom = carryBoundary(instance.carryFromRef.current, holding);

      // Read once and cleared, so a re-render for any other reason cannot carry
      // pages under a boundary that no longer describes anything. A sort leaves
      // it null, and a sort therefore carries nothing.
      instance.carryFromRef.current = null;

      if (carriedFrom !== null) {
        carryPagesBefore(from.store, store, carriedFrom);
      }

      return { stateKey: key, store, total: 0, carriedFrom };
    },
  );

  // A boundary must never outlive the change that measured it. Opening a hold
  // consumes the cell above; this clears it on every render that has no hold at
  // all, which is every OTHER way a boundary can be left behind: the first
  // render of a mount, the render after an adoption, and — the one that showed
  // wrong data — the click that puts the user back on the state already on
  // screen. That click writes a boundary and opens no pending view, so without
  // this line the NEXT sort would find it and carry pages the sort itself moves.
  if (pending === null) {
    instance.carryFromRef.current = null;
  }

  // The loader always fills the NEWEST state and the renderer always reads the
  // adopted one. While the two differ, the grid shows old rows and loads new
  // ones.
  const loadingView = pending ?? displayed;

  // The push subscriber (data/sync/useRowSync.ts) reads the stores through these
  // cells, so it survives without re-subscribing. `storeRef` names the DISPLAYED
  // store, so a pushed row lands on rows the user can actually see.
  instance.storeRef.current = displayed.store;

  // And this one names the store the hold is filling, or null outside a hold.
  // An update moves no position, so it must not bump the generation and reload
  // the window for one cell; it patches instead. But a patch that reached only
  // the displayed store would be discarded by the very next adoption, and a row
  // the pending store alone holds would be dropped as "not loaded". Publishing
  // the second store is what lets one push maintain both.
  instance.pendingStoreRef.current = pending?.store ?? null;

  const loadRange = useMemo(
    () => widenedForPrecedingGroup(range, descriptor.grouping),
    [descriptor.grouping, range],
  );

  // `statusRange` stays the caller's own, un-widened window. `loadRange` may
  // hold an extra page fetched only for `precedingGroupKey`; that page is off
  // screen, so whether it loads or fails must never change what `status`
  // reports about the page(s) the user can actually see.
  const { status, settled, retry } = useRowPages({
    descriptor,
    store: loadingView.store,
    range: loadRange,
    statusRange: range,
    sort,
    collapsedGroups,
    onRowsLoaded,
  });

  // Keyed on the CURRENT collapse set, so during a hold it describes the
  // PENDING view, not the one on screen. `displayed.total` is what the grid
  // draws with until adoption moves it.
  const { total: liveTotal, settled: countSettled } = useRowCount(descriptor, collapsedGroups);
  const knownTotal = totalIfKnown(liveTotal, loadingView.store, range.offset);

  // Only when nothing is pending, because then `liveTotal` and the displayed
  // store answer for the same state. During a hold this assignment is exactly
  // the bug the hold removes: a total that moves before its rows do sizes the
  // scroll bar for rows the grid is not showing.
  if (pending === null && knownTotal !== undefined) {
    displayed.total = knownTotal;
  }

  // THE SWAP. Everything above builds the pending view; this is the one place
  // that puts it on screen.
  useEffect(() => {
    if (pending === null) {
      return;
    }

    // EVERY page of the un-widened window, not the first index alone.
    // `rangeForViewport` starts the window one page ABOVE the viewport, so for
    // any grid scrolled past the first page `range.offset` names a page nobody
    // can see. Adopting when that page lands draws the whole viewport as
    // loading cells — the blank this hold exists to remove.
    //
    // A failed page counts as settled. Holding old rows under a permanent error
    // hides the banner and the retry behind data the user cannot act on, which
    // is worse than an empty grid that says so.
    if (!isSettled(pending.store, range)) {
      return;
    }

    // The rows and the total describe one state together, so the swap normally
    // waits for the count of the new collapse set as well. The carried pages
    // make the rows ready in the render the change lands in, long before that
    // count returns.
    //
    // A window that lies WHOLLY above the boundary is the one exception. Those
    // rows hold the same index under both collapse sets, so the swap changes no
    // cell the user can see, and waiting would dim the grid for a round trip
    // that moves nothing but the scroll bar.
    if (!countSettled && !windowUnmoved(pending, range)) {
      return;
    }

    // The count request for the new state may still be in flight. Carrying the
    // old number across for one render is wrong by less than blanking the grid,
    // and the render-time assignment above corrects it the moment it lands.
    pending.total = knownTotal ?? displayed.total;

    // Republished here as well as during render, so a push that flushes between
    // this swap and the next render patches the store now on screen — and no
    // longer patches it a second time as a store still loading behind it.
    instance.storeRef.current = pending.store;
    instance.pendingStoreRef.current = null;

    // The overlay is NOT swapped or cleared. It is keyed by row key, never by
    // index, so a change of index space says nothing about the entries in it,
    // and every entry in it is by construction still in flight — both `commit`
    // and `rollback` delete. Clearing here dropped the optimistic value and the
    // pending tint of a save the user started on the held view, and the save
    // then settled into a store nothing draws: the edit vanished with no error.
    adopt(pending);
    // `settled` is what re-runs this: it bumps every time a page of the pending
    // view lands or fails, and nothing else reports that the pending store
    // moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pending,
    displayed,
    instance,
    range.offset,
    range.limit,
    knownTotal,
    countSettled,
    settled,
    adopt,
  ]);

  const span = useMemo(
    () =>
      spanFromStore<TRow, TGroup, TKey>(
        displayed.store,
        range.offset,
        range.limit,
        descriptor.grouping,
      ),
    // `settled` stands in for "the store changed": it bumps every time a page
    // of this window lands, and the span is a pure read of the store at this
    // window. `status` cannot stand in for it — `statusOf` answers "ready" as
    // soon as the FIRST page of the window is loaded and never moves again
    // while pages 2 and 3 arrive, so a memo keyed on it would hold the span at
    // one page. `spanFromStore` stops at the first hole and `useDisplayModel`
    // reads every group boundary out of `span.rows`, so a frozen span means a
    // header for a group opening past that first page never draws.
    //
    // `adoptions` is here for the other kind of change: a swap hands the
    // renderer a different store, and the rows it holds settled before it was
    // adopted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayed.store, range.offset, range.limit, descriptor.grouping, settled, adoptions],
  );

  const rowAt = useCallback(
    (dataIndex: number): TRow | undefined => {
      const row = displayed.store.getRow(dataIndex);

      if (row === undefined) {
        return undefined;
      }

      return overlay.apply(descriptor.rowKey(row), row);
    },
    [displayed.store, overlay, descriptor],
  );

  const isPending = useCallback((key: TKey) => overlay.isPending(key), [overlay]);

  /**
   * Whether committing this window would start no request at all.
   *
   * `useWindowRange` asks before it decides to wait. Two stores have to answer,
   * and only outside a hold are they the same object:
   *
   * - `displayed.store` is what `span` reads, so it decides whether the window
   *   can DRAW without a fetch.
   * - `loadingView.store` is what `useRowPages` fills, so it decides whether
   *   the window would FETCH. During a hold this is the pending store, which
   *   is normally still filling — a held grid keeps the wait, which is right,
   *   because a hold is exactly when requests are in flight.
   *
   * The widened range, not the caller's: a grouped window also needs the row
   * above it loaded, or `precedingGroupKey` reads null and the first header
   * draws wrong. Committing early on a window missing that page would trade the
   * delay for a flicker.
   */
  const isRangeLoaded = useCallback(
    (candidate: WindowRange): boolean => {
      const widened = widenedForPrecedingGroup(candidate, descriptor.grouping);

      if (!holdsEveryPage(displayed.store, widened)) {
        return false;
      }

      if (loadingView.store !== displayed.store && !holdsEveryPage(loadingView.store, widened)) {
        return false;
      }

      return true;
    },
    // `settled` and `adoptions` are what report that a store's page states
    // moved; neither store changes identity when a page lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayed.store, loadingView.store, descriptor.grouping, settled, adoptions],
  );

  return {
    rowAt,
    isPending,
    isRangeLoaded,

    // `displayed.total`, never `liveTotal`. The render-time assignment above is
    // the only writer, and `totalIfKnown` guards it: a count of 0 reaches the
    // screen only once the store PROVES the view is empty. `countSettled` may
    // not be used here, because it also reads true for a REJECTED count, whose
    // `liveTotal` is 0 — and publishing that empties a grid whose rows are all
    // on screen, with no banner, because `status` speaks for pages alone.
    total: displayed.total,
    span,
    status,
    retry,
    isStale: pending !== null,
    store: displayed.store,
    overlay,
  };
}

/** The two view states, and the one way to move a state from pending to shown. */
interface ViewPair<TRow extends object, TKey extends string | number> {
  /** What the screen reads. */
  displayed: ViewState<TRow, TKey>;

  /** The new sort or collapse set filling up behind it, or null outside a hold. */
  pending: ViewState<TRow, TKey> | null;

  /** Counts adoptions. A memo that reads the displayed store may key on it. */
  adoptions: number;

  /** Puts a view on screen and ends the hold. */
  adopt: (view: ViewState<TRow, TKey>) => void;
}

/**
 * Holds TWO view states, never one, and keeps them matched to the current state
 * key.
 *
 * The reconciliation runs DURING render, not in an effect. An effect runs after
 * the paint, so on the first render of a new sort `pending` would still be
 * null, the caller would still point the loader at the displayed store, and
 * pages fetched under the new sort would land among rows fetched under the old
 * one. That is wrong data on screen rather than a flash.
 */
function useViewPair<TRow extends object, TKey extends string | number>(
  stateKey: string,
  createFirstView: (key: string) => ViewState<TRow, TKey>,
  createPendingView: (
    key: string,
    from: ViewState<TRow, TKey>,
    holding: ViewState<TRow, TKey> | null,
  ) => ViewState<TRow, TKey>,
): ViewPair<TRow, TKey> {
  // Bumped on adoption. It is the only thing that makes a swap reach React,
  // because both views live in refs and a ref write re-renders nothing.
  const [adoptions, setAdoptions] = useState(0);

  const displayedRef = useRef<ViewState<TRow, TKey> | null>(null);
  displayedRef.current ??= createFirstView(stateKey);

  const pendingRef = useRef<ViewState<TRow, TKey> | null>(null);

  if (displayedRef.current.stateKey === stateKey) {
    // Includes the case where the user goes back to the state on screen mid
    // hold. The pending view is then dead weight, and dropping it ends the hold
    // without a round trip.
    pendingRef.current = null;
  } else if (pendingRef.current?.stateKey !== stateKey) {
    // The pending view is built FROM the displayed one, and it is told about
    // the hold it replaces: the pages it may keep are the pages that neither
    // change moves. Replacing rather than adding is what keeps two stores the
    // most this hook can reach.
    pendingRef.current = createPendingView(stateKey, displayedRef.current, pendingRef.current);
  }

  const adopt = useCallback((view: ViewState<TRow, TKey>) => {
    displayedRef.current = view;
    pendingRef.current = null;

    setAdoptions((n) => n + 1);
  }, []);

  return {
    displayed: displayedRef.current,
    pending: pendingRef.current,
    adoptions,
    adopt,
  };
}

/**
 * The window to FETCH for a window to DRAW.
 *
 * A grouped grid's span needs the row just above the window loaded too, so
 * `spanFromStore` can tell whether the window's first row opens a group or
 * continues one (`precedingGroupKey`). `rangeForViewport` always starts a
 * window on a page boundary, so that row sits in the page BEFORE the window's
 * own pages — a page the window itself gives no other reason to load. A flat
 * grid never reads `precedingGroupKey`, so widening only for a descriptor with
 * `grouping` costs a flat grid nothing.
 */
function widenedForPrecedingGroup<TRow extends object, TGroup>(
  range: WindowRange,
  grouping: GridGrouping<TRow, TGroup> | undefined,
): WindowRange {
  if (!grouping || range.offset <= 0) {
    return range;
  }

  return { offset: range.offset - 1, limit: range.limit + 1 };
}

/**
 * The row count of a view, or undefined while the count request for it is still
 * in flight.
 *
 * `useRowCount` answers 0 for "the count is not back yet" and for "there are no
 * rows" alike, and the grid must not draw the two the same way: reading the
 * first as the second empties the grid for a render, which is the flash this
 * hook exists to remove. The store settles it. Once the page holding the
 * window's first index is loaded and still serves no row there, the view really
 * is empty; until then a zero is only silence.
 */
function totalIfKnown<TRow extends object, TKey extends string | number>(
  liveTotal: number,
  store: RowStore<TRow, TKey>,
  firstIndex: number,
): number | undefined {
  if (liveTotal > 0) {
    return liveTotal;
  }

  const page = store.pageOf(firstIndex);

  if (store.pageState(page) === "loaded" && store.getRow(firstIndex) === undefined) {
    return 0;
  }

  return undefined;
}

/**
 * Whether the change into this view leaves every row of the window where it
 * already sits.
 *
 * A collapse moves the rows AT AND BELOW one group, so a window that ends above
 * that boundary shows the same rows at the same indexes on both sides of the
 * change. Swapping such a view in repaints nothing, which is why the swap may
 * run before the new count returns.
 *
 * It reads the boundary, not the carried pages. A page above the boundary that
 * did NOT carry — the store never held it — is fetched under the new collapse
 * set and comes back with those very same rows, so the answer is the same
 * either way.
 */
function windowUnmoved<TRow extends object, TKey extends string | number>(
  view: ViewState<TRow, TKey>,
  range: WindowRange,
): boolean {
  if (view.carriedFrom === null) {
    return false;
  }

  return range.offset + range.limit <= view.carriedFrom;
}

/**
 * Whether a store holds every page a window touches, loaded and readable.
 *
 * Stricter than `isSettled`, and the difference is the point. `isSettled` counts
 * a FAILED page as an answer, because a hold has to end on an error as much as
 * on success. This question is "would committing this window fetch anything",
 * and a failed page is one the retry button asks for again — so it reads false
 * and the window keeps its wait.
 */
function holdsEveryPage<TRow extends object, TKey extends string | number>(
  store: RowStore<TRow, TKey>,
  range: WindowRange,
): boolean {
  const firstPage = store.pageOf(range.offset);
  const lastPage = store.pageOf(Math.max(range.offset, range.offset + range.limit - 1));

  for (let page = firstPage; page <= lastPage; page += 1) {
    if (store.pageState(page) !== "loaded") {
      return false;
    }
  }

  return true;
}

/**
 * Whether a store has finished answering for every page a window touches.
 *
 * `failed` counts, because a page that failed has finished. `missing` does not:
 * the loader re-requests it, and a settle bump brings this question back. The
 * hold therefore ends for every outcome a request can have — a page ends
 * `loaded`, or `failed`, or goes back to `missing` and is asked again. The one
 * thing that can hold it open is a fetch promise that never settles at all,
 * which is the same single exposure a one-page gate had.
 */
function isSettled<TRow extends object, TKey extends string | number>(
  store: RowStore<TRow, TKey>,
  range: WindowRange,
): boolean {
  const firstPage = store.pageOf(range.offset);
  const lastPage = store.pageOf(Math.max(range.offset, range.offset + range.limit - 1));

  for (let page = firstPage; page <= lastPage; page += 1) {
    const state = store.pageState(page);

    if (state !== "loaded" && state !== "failed") {
      return false;
    }
  }

  return true;
}
