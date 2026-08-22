import { queryOptions, useQuery } from "@tanstack/react-query";
import type { GridDescriptor } from "../types";

/**
 * Collapse state changes the row count, so it belongs in the key. Sorted for
 * the same reason the row keys sort it: collapse order is not identity.
 *
 * A filter changes the count too, so it goes in the key as well. It is opaque:
 * TanStack hashes the key structurally, so any serialisable value works and
 * this module never reads inside it.
 *
 * An absent filter appends nothing, which keeps the unfiltered key a PREFIX of
 * every filtered one. `data/sync/useRowSync.ts` invalidates by that prefix
 * after a push, so one recount reaches every filter variant.
 */
export function rowCountKey(
  name: string,
  collapsedGroups: unknown[],
  filter?: unknown,
): readonly unknown[] {
  const base = [name, "count", [...collapsedGroups].sort()];
  return filter === undefined ? base : [...base, filter];
}

function rowCountQuery<TRow, TGroup, TKey extends string | number>(
  descriptor: GridDescriptor<TRow, TGroup, TKey>,
  collapsedGroups: TGroup[],
  filter?: unknown,
) {
  return queryOptions({
    queryKey: rowCountKey(descriptor.name, collapsedGroups, filter),
    queryFn: ({ signal }) => descriptor.api.fetchCount({ collapsedGroups, filter, signal }),
  });
}

/**
 * The total glide needs to size its scroll bar, and whether the request for the
 * CURRENT view — collapse set and filter alike — has answered. A live query
 * returns rows, not a total, so this is a separate request by design.
 *
 * `settled` exists because the total falls to 0 while a new key loads, and a
 * grid that adopts a total of 0 draws nothing. The hold in `useGridData` waits
 * on this flag rather than on the number.
 *
 * A REJECTED request counts as settled, for the same reason a failed page counts
 * in `useGridData`'s `isSettled`: a hold that never ends leaves the previous
 * collapse state on screen for ever, and the user can act on none of it.
 */
export function useRowCount<TRow, TGroup, TKey extends string | number>(
  descriptor: GridDescriptor<TRow, TGroup, TKey>,
  collapsedGroups: TGroup[],
  filter?: unknown,
): { total: number; settled: boolean } {
  const { data, status } = useQuery(rowCountQuery(descriptor, collapsedGroups, filter));

  return { total: data ?? 0, settled: status !== "pending" };
}
