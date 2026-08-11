/**
 * How many pages of rows stay in memory at once.
 *
 * The grid targets millions of rows, so nothing here may grow with the table.
 * At the default page size of 100 this holds 2,400 rows, which is far more than
 * any viewport plus its scroll-ahead, and it bounds the store no matter how far
 * the user scrolls.
 *
 * It also has to stay well above the number of pages ONE WINDOW spans, which is
 * three or four (`hooks/useWindowRange.ts` takes the pages the viewport touches
 * plus one either side). Eviction drops the page furthest from the page just
 * written, so a page of the current window could only be chosen once every
 * other page sat nearer than it — and at most five pages lie within two of any
 * given page. A cap of 24 therefore makes "the loading window evicts itself"
 * unreachable rather than merely unlikely.
 */
export const MAX_LOADED_PAGES = 24;

/**
 * What the store knows about one page.
 *
 * `failed` is separate from `missing` on purpose. A page nobody asked for and a
 * page whose request was rejected both hold no rows, and only the second one
 * must show an error instead of a spinner.
 */
export type PageState = "missing" | "loading" | "loaded" | "failed";

export interface RowStore<TRow extends object, TKey extends string | number> {
  /** Rows per page. Fixed for the life of the store. */
  readonly pageSize: number;

  /** The page an absolute row index belongs to. */
  pageOf: (index: number) => number;

  /** The row at an absolute index, or undefined when the store does not hold it. */
  getRow: (index: number) => TRow | undefined;

  /**
   * Where a row sits, by its stable key. A push names a row by key and the grid
   * repaints by index, so this is the bridge between them.
   */
  indexOfKey: (key: TKey) => number | undefined;

  pageState: (page: number) => PageState;

  /** The pages the store holds rows for, ascending. */
  loadedPages: () => number[];

  /** The rows of one loaded page, or undefined when the store lacks it. */
  pageRows: (page: number) => readonly TRow[] | undefined;

  markLoading: (page: number) => void;

  markFailed: (page: number) => void;

  /** Puts a page back to `missing`, so the loader asks for it again. */
  markMissing: (page: number) => void;

  /**
   * Stores one page and answers with the absolute indexes it wrote, which is
   * exactly the damage list the caller hands to glide.
   */
  writePage: (page: number, rows: readonly TRow[]) => number[];

  /**
   * Merges a patch into one stored row and answers with its index, or undefined
   * when the store does not hold that row.
   */
  patchRow: (key: TKey, patch: Partial<TRow>) => number | undefined;
}

/**
 * The grid's row cache: pages of rows held by absolute index, bounded by a
 * fixed cap on how many pages stay in memory.
 *
 * It holds SERVER TRUTH only. An edit that has not landed lives in
 * `data/editOverlay.ts`, never here, which is what makes a rollback a delete
 * rather than a restore.
 *
 * Eviction is by DISTANCE, not by recency. A grid scrolls, so the page most
 * worth keeping is the one nearest where the user is looking, and the page just
 * written is the best evidence of where that is. An LRU would answer nearly the
 * same question while needing a touched-page order maintained on every read —
 * and `getRow` runs once per visible cell per paint, roughly 400 times a frame.
 * Distance needs no bookkeeping at all: it is a subtraction over the keys the
 * store already holds.
 */
export function createRowStore<TRow extends object, TKey extends string | number>(
  pageSize: number,
  rowKey: (row: TRow) => TKey,
  maxPages: number = MAX_LOADED_PAGES,
): RowStore<TRow, TKey> {
  const pages = new Map<number, TRow[]>();
  const states = new Map<number, PageState>();
  const indexByKey = new Map<TKey, number>();

  const pageOf = (index: number) => Math.floor(index / pageSize);

  const forgetPage = (page: number) => {
    const rows = pages.get(page);

    if (rows === undefined) {
      return;
    }

    // The key map must lose the dropped page's keys, or `indexOfKey` would
    // answer with an index the store cannot serve — and a push would then
    // damage a cell that holds nothing.
    for (const row of rows) {
      indexByKey.delete(rowKey(row));
    }

    pages.delete(page);
    states.delete(page);
  };

  /**
   * Brings the store back to the cap by dropping the page furthest from
   * `nearPage`, repeatedly.
   *
   * `nearPage` is never a candidate: its own distance is 0, so it can only be
   * chosen when it is the sole page left, and the loop stops above the cap
   * before that.
   */
  const evictFurthestFrom = (nearPage: number) => {
    while (pages.size > maxPages) {
      let furthest = -1;
      let worstDistance = -1;

      for (const page of pages.keys()) {
        const distance = Math.abs(page - nearPage);

        if (distance > worstDistance) {
          worstDistance = distance;
          furthest = page;
        }
      }

      if (furthest < 0) {
        return;
      }

      forgetPage(furthest);
    }
  };

  return {
    pageSize,
    pageOf,

    getRow(index) {
      const rows = pages.get(pageOf(index));

      if (rows === undefined) {
        return undefined;
      }

      return rows[index % pageSize];
    },

    indexOfKey(key) {
      return indexByKey.get(key);
    },

    pageState(page) {
      return states.get(page) ?? "missing";
    },

    loadedPages() {
      return [...pages.keys()].sort((a, b) => a - b);
    },

    pageRows(page) {
      return pages.get(page);
    },

    markLoading(page) {
      states.set(page, "loading");
    },

    markFailed(page) {
      states.set(page, "failed");
    },

    markMissing(page) {
      states.delete(page);
    },

    writePage(page, rows) {
      forgetPage(page);

      const stored = [...rows];
      const start = page * pageSize;
      const written: number[] = [];

      for (let i = 0; i < stored.length; i += 1) {
        indexByKey.set(rowKey(stored[i]), start + i);
        written.push(start + i);
      }

      pages.set(page, stored);
      states.set(page, "loaded");

      evictFurthestFrom(page);

      return written;
    },

    patchRow(key, patch) {
      const index = indexByKey.get(key);

      if (index === undefined) {
        return undefined;
      }

      const rows = pages.get(pageOf(index));

      if (rows === undefined) {
        return undefined;
      }

      const slot = index % pageSize;
      rows[slot] = { ...rows[slot], ...patch };

      return index;
    },
  };
}

/**
 * Copies the pages that a change does not move from one store into another.
 *
 * `boundaryIndex` is the first data index the change moves. A page that ends
 * above it holds the same rows at the same indexes on both sides of the change,
 * so the new view may start with it already loaded. Answers with how many pages
 * carried, which the tests read and nothing else does.
 *
 * Rows go through `writePage`, never through the maps directly. That is what
 * puts the keys in the target's key map, and a push finds a row by key.
 *
 * Carrying more pages than `MAX_LOADED_PAGES` is safe. `writePage` evicts as it
 * goes, and it evicts the page furthest from the one just written. The loop runs
 * ascending, so the pages nearest the boundary — the ones the window is most
 * likely to want — are the ones that survive.
 */
export function carryPagesBefore<TRow extends object, TKey extends string | number>(
  source: RowStore<TRow, TKey>,
  target: RowStore<TRow, TKey>,
  boundaryIndex: number,
): number {
  let carried = 0;

  for (const page of source.loadedPages()) {
    const lastIndex = (page + 1) * source.pageSize - 1;

    // The page that straddles the boundary holds rows on both sides of the
    // move, and a store cannot split a page. It reloads instead.
    if (lastIndex >= boundaryIndex) {
      continue;
    }

    const rows = source.pageRows(page);

    if (rows !== undefined) {
      target.writePage(page, rows);
      carried += 1;
    }
  }

  return carried;
}
