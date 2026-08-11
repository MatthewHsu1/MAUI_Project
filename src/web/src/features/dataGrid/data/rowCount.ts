import { queryOptions, useQuery } from "@tanstack/react-query";
import type { GridDescriptor } from "../types";

/**
 * Collapse state changes the row count, so it belongs in the key. Sorted for
 * the same reason the row keys sort it: collapse order is not identity.
 */
export function rowCountKey(name: string, collapsedGroups: unknown[]): readonly unknown[] {
  return [name, "count", [...collapsedGroups].sort()];
}

function rowCountQuery<TRow, TGroup, TKey extends string | number>(
  descriptor: GridDescriptor<TRow, TGroup, TKey>,
  collapsedGroups: TGroup[],
) {
  return queryOptions({
    queryKey: rowCountKey(descriptor.name, collapsedGroups),
    queryFn: ({ signal }) => descriptor.api.fetchCount({ collapsedGroups, signal }),
  });
}

/**
 * The total glide needs to size its scroll bar, and whether the request for the
 * CURRENT collapse set has answered. A live query returns rows, not a total, so
 * this is a separate request by design.
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
): { total: number; settled: boolean } {
  const { data, status } = useQuery(rowCountQuery(descriptor, collapsedGroups));

  return { total: data ?? 0, settled: status !== "pending" };
}
