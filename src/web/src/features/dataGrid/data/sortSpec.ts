import type { GridSort } from "../types";

/**
 * One description of an order, read by three parties that must agree: the live
 * query that orders loaded rows, the api mapper that asks the server for a
 * slice, and the fake server in tests.
 *
 * `nulls` and the tie-break exist because a disagreement between client and
 * server ordering shows up as rows that swap or jump under a still viewport.
 * The tie-break on the row key makes every order total.
 */
export interface SortSpec {
  field: string;
  direction: "asc" | "desc";
  nulls: "first" | "last";
}

/**
 * Translates the grid's stored sort into a spec. Nulls always sort last, in
 * both directions, matching the previous `compareRows` behaviour in bondGrid.
 *
 * It takes no key field. A `SortSpec` describes one column's order and nothing
 * else, and the tie-break on the row key is applied by whoever holds the rows:
 * `compareBySpec` takes `rowKey` as its own argument. A key field on the spec
 * would therefore be set by the one producer and read by nobody, so the
 * parameter was dead by construction, not merely unread.
 */
export function specFromGridSort(sort: GridSort | null | undefined): SortSpec | null {
  if (!sort) return null;
  return { field: sort.field, direction: sort.dir, nulls: "last" };
}

/**
 * The one comparator. Total: equal values fall back to the row key, so no two
 * distinct rows ever compare equal.
 */
export function compareBySpec<T>(
  a: T,
  b: T,
  spec: SortSpec,
  rowKey: (row: T) => string | number,
): number {
  const av = (a as Record<string, unknown>)[spec.field];
  const bv = (b as Record<string, unknown>)[spec.field];
  const sign = spec.direction === "asc" ? 1 : -1;
  const nullSign = spec.nulls === "last" ? 1 : -1;

  if (av == null && bv == null) return tieBreak(a, b, rowKey);
  if (av == null) return nullSign;
  if (bv == null) return -nullSign;

  let cmp: number;
  if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
  else cmp = String(av).localeCompare(String(bv));

  if (cmp !== 0) return cmp * sign;

  return tieBreak(a, b, rowKey);
}

/** Direction-independent, so a tie resolves to one stable order. */
function tieBreak<T>(a: T, b: T, rowKey: (row: T) => string | number): number {
  const ak = rowKey(a);
  const bk = rowKey(b);
  if (typeof ak === "number" && typeof bk === "number") return ak - bk;
  return String(ak).localeCompare(String(bk));
}
