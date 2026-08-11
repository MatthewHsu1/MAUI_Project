import { compareBySpec, type SortSpec } from "../../dataGrid/data/sortSpec";
import { SECTORS, type TestRow } from "../api/types";
import { DEFAULT_ROW_COUNT, DEFAULT_SEED, generateRows } from "./generateRows";

/**
 * One slice request, as the store sees it. It is the HTTP query already parsed,
 * so the handlers hold no logic beyond parsing.
 */
export interface SliceQuery {
  /**
   * Index of the first row, counted over the VISIBLE rows.
   */
  offset: number;

  /**
   * How many rows to return.
   */
  limit: number;

  /**
   * The user's column sort, applied inside a sector. Null means natural order.
   */
  sort: SortSpec | null;

  /**
   * Sectors the user collapsed. Their rows leave both the slice and the count,
   * which is what a real grouped server does.
   */
  collapsed: string[];
}

/**
 * The synthetic server's data. Everything a handler needs, and nothing about
 * HTTP.
 */
export interface TestRowStore {
  /**
   * One ordered, filtered slice.
   */
  slice(query: SliceQuery): TestRow[];

  /**
   * How many rows a slice request would see in total.
   */
  count(collapsed: string[]): number;

  /**
   * One row by id, or undefined.
   */
  find(id: number): TestRow | undefined;

  /**
   * Applies `changes`, recomputes `value`, and returns the whole row. Undefined
   * when no row has that id.
   */
  update(id: number, changes: Partial<TestRow>): TestRow | undefined;

  /**
   * Regenerates the rows from the seed, dropping every edit. Returns the row
   * count.
   */
  reset(): number;
}

/**
 * How many ordered views the store keeps. A scroll produces one request per
 * window, and ordering 100,000 rows costs about 50 ms, so an uncached store
 * would be the slow part of every measurement this page exists to make.
 *
 * Three covers the common pattern: the current sort, the previous one, and the
 * unsorted view underneath both.
 */
const MAX_CACHED_ORDERS = 3;

const SECTOR_INDEX = new Map(SECTORS.map((sector, index) => [sector as string, index]));

/** Rounds to two decimals, matching the generator's currency values. */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Today, as the ISO date the date cell stores. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Names one ordered view. Two requests that share this string may share the
 * ordered array.
 */
function viewKey(sort: SortSpec | null, collapsed: string[]): string {
  const order = sort ? `${sort.field}:${sort.direction}:${sort.nulls}` : "natural";
  return `${order}|${[...collapsed].sort().join(",")}`;
}

/**
 * Builds a store over `count` generated rows.
 *
 * Exported for tests, which use a small count. The application uses the
 * `testRowStore` singleton below.
 */
export function createTestRowStore(
  count: number = DEFAULT_ROW_COUNT,
  seed: number = DEFAULT_SEED,
): TestRowStore {
  let rows: TestRow[] = generateRows(count, seed);
  let byId = new Map(rows.map((row) => [row.id, row]));

  const views = new Map<string, TestRow[]>();

  const sectorRank = (row: TestRow): number => SECTOR_INDEX.get(row.sector) ?? SECTORS.length;

  /**
   * The one ordering rule: sector first, then the user's sort, then the id.
   * `compareBySpec` is the same comparator the client live query mirrors — a
   * disagreement between the two shows up as rows that jump under a still
   * viewport.
   */
  const compare = (a: TestRow, b: TestRow, sort: SortSpec | null): number => {
    const bySector = sectorRank(a) - sectorRank(b);

    if (bySector !== 0) {
      return bySector;
    }

    if (!sort) {
      return a.id - b.id;
    }

    return compareBySpec(a, b, sort, (row) => row.id);
  };

  const view = (sort: SortSpec | null, collapsed: string[]): TestRow[] => {
    const key = viewKey(sort, collapsed);
    const cached = views.get(key);

    if (cached) {
      return cached;
    }

    const hidden = new Set(collapsed);
    const visible = hidden.size === 0 ? [...rows] : rows.filter((r) => !hidden.has(r.sector));

    visible.sort((a, b) => compare(a, b, sort));
    views.set(key, visible);

    if (views.size > MAX_CACHED_ORDERS) {
      // Map iterates in insertion order, so the first key is the oldest.
      const oldest = views.keys().next().value;

      if (oldest !== undefined) {
        views.delete(oldest);
      }
    }

    return visible;
  };

  return {
    slice(query) {
      const ordered = view(query.sort, query.collapsed);
      return ordered.slice(query.offset, query.offset + query.limit);
    },

    count(collapsed) {
      return view(null, collapsed).length;
    },

    find(id) {
      return byId.get(id);
    },

    update(id, changes) {
      const current = byId.get(id);

      if (!current) {
        return undefined;
      }

      const next: TestRow = { ...current, ...changes, id: current.id, sector: current.sector };
      next.value = money(next.quantity * next.price);

      if (changes.updatedAt === undefined) {
        next.updatedAt = today();
      }

      const index = rows.indexOf(current);
      rows[index] = next;
      byId.set(id, next);

      // Every cached view holds the OLD row object, and an edit can also move
      // the row inside its sector. Rebuilding is cheaper to reason about than
      // patching each view in place, and an edit is rare next to a scroll.
      views.clear();

      return next;
    },

    reset() {
      rows = generateRows(count, seed);
      byId = new Map(rows.map((row) => [row.id, row]));
      views.clear();

      return rows.length;
    },
  };
}

/**
 * The store the MSW handlers use. Built at import, but the rows are generated
 * inside `createTestRowStore`, and `src/mocks/browser.ts` — the only module that
 * reaches this file — is itself behind a dynamic import in a DEV branch. So no
 * production bundle pays for it.
 */
export const testRowStore = createTestRowStore();
