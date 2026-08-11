import type { Rectangle } from "@glideapps/glide-data-grid";
import { useDebouncer } from "@tanstack/react-pacer";
import { useCallback, useRef, useState } from "react";
import { dataRangeInDisplayRange, type DisplayModel } from "../displayModel";

/**
 * How long scrolling must settle before a window that needs a FETCH is
 * committed. Long enough that flinging through a long list requests nothing it
 * passes. A window the store already holds skips this wait entirely — see
 * `useWindowRange`.
 */
export const WINDOW_COMMIT_WAIT_MS = 120;

export interface WindowRange {
  offset: number;
  limit: number;
}

/**
 * Whether the store already holds every row a candidate window needs, so
 * committing it starts no request.
 *
 * The grid supplies this rather than the hook computing it: the hook is pure
 * viewport arithmetic and holds no store, and the store that answers depends on
 * whether a sort or collapse hold is running. See `useGridData.isRangeLoaded`.
 */
export type RangeLoaded = (range: WindowRange) => boolean;

/**
 * Which rows a visible display range needs: the pages it touches, plus one page
 * either side so a small scroll does not stall on a fetch. Null when the range
 * holds no data rows at all. Pure.
 */
export function rangeForViewport<TGroup>(
  model: DisplayModel<TGroup>,
  fromDisplay: number,
  toDisplay: number,
  pageSize: number,
): WindowRange | null {
  const span = dataRangeInDisplayRange(model, fromDisplay, toDisplay);
  if (span === null) return null;

  const firstStart = Math.floor(span.min / pageSize) * pageSize;
  const lastStart = Math.floor(span.max / pageSize) * pageSize;

  const offset = Math.max(0, firstStart - pageSize);
  const end = lastStart + 2 * pageSize;

  return { offset, limit: end - offset };
}

/**
 * Translates glide's visible rectangle into the one range the grid loads.
 *
 * THE WAIT GUARDS THE NETWORK, NOT THE WINDOW. A window the store already
 * holds commits on the frame the scroll reaches it, because committing it
 * starts no request and there is nothing to guard against. Only a window that
 * would fetch waits for the scroll to settle.
 *
 * That split is what makes scrolling back over rows the grid has already loaded
 * feel immediate. Under one flat wait it did not: a grouped grid reads its
 * headers out of `span`, `span` keys on this range, and so every scroll-back
 * paid `WINDOW_COMMIT_WAIT_MS` before the headers caught up to rows that were
 * sitting in memory the whole time.
 *
 * One rule carries over from the window-set model. A range that describes no
 * data rows — a viewport of group headers only, or a collapsed view — keeps the
 * previous range instead of committing nothing, because glide dedupes its
 * region callback on the rectangle and would never ask again.
 */
export function useWindowRange(
  pageSize: number,
  isLoadedRef?: { current: RangeLoaded | null },
): {
  range: WindowRange;
  onRectChanged: <TGroup>(model: DisplayModel<TGroup>, rect: Rectangle) => void;
} {
  const [range, setRange] = useState<WindowRange>({ offset: 0, limit: pageSize });

  const apply = useCallback((next: WindowRange) => {
    setRange((prev) => (prev.offset === next.offset && prev.limit === next.limit ? prev : next));
  }, []);

  // `useDebouncer` rather than `useDebouncedCallback`, for `cancel()` alone. The
  // immediate path below has to drop a wait already armed: a flick into cold
  // data arms one, and a scroll straight back to cached rows must not let that
  // stale window land 120 ms later on top of the one the user is looking at.
  const commit = useDebouncer(apply, { wait: WINDOW_COMMIT_WAIT_MS });

  // The range the last call ASKED for, which is not the committed range: a
  // request sits in the debouncer for `WINDOW_COMMIT_WAIT_MS` before it lands.
  // Comparing against the committed range instead would re-ask for the pending
  // one on every rect change and reset the timer, which is the starvation this
  // ref exists to stop.
  const requestedRef = useRef<WindowRange>({ offset: 0, limit: pageSize });

  // The model arrives per call, not per hook: this hook runs before the model
  // exists in a render, and glide calls back after it does.
  const onRectChanged = useCallback(
    <TGroup>(model: DisplayModel<TGroup>, rect: Rectangle) => {
      const next = rangeForViewport(model, rect.y, rect.y + rect.height, pageSize);

      if (next === null) {
        return;
      }

      // THE DEDUPE RUNS BEFORE THE TIMER, NOT INSIDE IT.
      //
      // `rangeForViewport` is page-aligned, so a scroll that stays inside one
      // window recomputes the SAME range on every frame. Passing each of those
      // to the debouncer restarts its timer, and a steady scroll restarts it
      // faster than it can fire. Four seconds of slow dragging then committed
      // nothing at all, and the user scrolled into blank cells that no request
      // was ever going to fill.
      //
      // Dropping the repeat here leaves the debouncer only the calls that
      // really move the window — one per page boundary the viewport crosses —
      // so the timer runs out between them and the window commits.
      const prev = requestedRef.current;

      if (prev.offset === next.offset && prev.limit === next.limit) {
        return;
      }

      requestedRef.current = next;

      // THE RULE: the wait is the price of a request, so a window that makes no
      // request does not pay it.
      //
      // `isLoadedRef` is read here, at call time, rather than taken as a value.
      // The predicate needs the store, `useGridData` needs this hook's range to
      // build one, and glide calls back after both have run — the same
      // over-time loop closure `DataGrid` uses for its model and column refs.
      if (isLoadedRef?.current?.(next) === true) {
        commit.cancel();
        apply(next);

        return;
      }

      commit.maybeExecute(next);
    },
    [pageSize, commit, apply, isLoadedRef],
  );

  return { range, onRectChanged };
}
