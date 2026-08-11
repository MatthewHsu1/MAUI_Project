import type { GridGrouping } from "../types";
import type { RowStore } from "./rowStore";

/**
 * The run of loaded rows the display model reads, and the group of the row just
 * above it.
 *
 * `rows` is CONTIGUOUS from `offset`. `detectBoundaries` walks it and reports a
 * group start at each change, so a gap inside it would place a header at a row
 * that does not open a group.
 */
export interface LoadedSpan<TRow, TGroup> {
  rows: TRow[];
  offset: number;
  precedingGroupKey: TGroup | null;
}

/**
 * Reads one window out of the store as a contiguous run.
 *
 * The run stops at the first index the store does not hold. That is stricter
 * than "every row in the window", and it has to be: `data/rowStore.ts` evicts a
 * page at a time, so a window that outlives one eviction really can hold a
 * hole, and `displayModel.detectBoundaries` cannot see one.
 *
 * `precedingGroupKey` is the group of the row at `offset - 1`. It never reaches
 * the display. It exists so `buildDisplayModel` knows whether the first visible
 * row opens a group or continues one. It is null at row 0, for a grid with no
 * grouping, and when the store does not hold that row — the last case reads as
 * "cannot tell", and a wrong guess would draw a header that does not belong.
 */
export function spanFromStore<TRow extends object, TGroup, TKey extends string | number>(
  store: RowStore<TRow, TKey>,
  offset: number,
  limit: number,
  grouping: GridGrouping<TRow, TGroup> | undefined,
): LoadedSpan<TRow, TGroup> {
  const rows: TRow[] = [];

  for (let i = offset; i < offset + limit; i += 1) {
    const row = store.getRow(i);

    if (row === undefined) {
      break;
    }

    rows.push(row);
  }

  return {
    rows,
    offset,
    precedingGroupKey: precedingGroupOf(store, offset, grouping),
  };
}

function precedingGroupOf<TRow extends object, TGroup, TKey extends string | number>(
  store: RowStore<TRow, TKey>,
  offset: number,
  grouping: GridGrouping<TRow, TGroup> | undefined,
): TGroup | null {
  if (!grouping || offset === 0) {
    return null;
  }

  const preceding = store.getRow(offset - 1);

  if (preceding === undefined) {
    return null;
  }

  return grouping.of(preceding);
}
