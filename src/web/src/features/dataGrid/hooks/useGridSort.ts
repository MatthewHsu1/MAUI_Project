// src/features/dataGrid/hooks/useGridSort.ts
import { useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import type { GridInstance, GridSort } from "../types";
import { useGridDispatch } from "../useGridDispatch";

export function nextSort(current: GridSort | null, field: string): GridSort | null {
  if (current?.field !== field) {
    return { field, dir: "asc" };
  }

  return current.dir === "asc" ? { field, dir: "desc" } : null;
}

export function useGridSort<TRow extends object, TGroup, TKey extends string | number = number>(
  instance: GridInstance<TRow, TGroup, TKey>,
  visibleFields: string[],
): { onHeaderClicked: (colIndex: number) => void } {
  const dispatch = useGridDispatch();

  const { descriptor } = instance;

  const sort = useSelector((s: unknown) => instance.selectRoot(s).groups.sort);

  // Default sortable predicate: editable columns only. Descriptors may override.
  // Memoized so it stays referentially stable for the useCallback below
  // (descriptor is fixed for the grid's lifetime).
  const sortable = useMemo(
    () =>
      descriptor.columns.sortable ??
      ((field: string) => descriptor.columns.defs[field]?.editable === true),
    [descriptor],
  );

  const onHeaderClicked = useCallback(
    (colIndex: number) => {
      const field = visibleFields[colIndex];

      if (!sortable(field)) return;

      // The sort is part of every window's cache key, so changing it is the
      // whole refetch: the mounted windows re-request themselves on the new key.
      dispatch(instance.actions.setSort(nextSort(sort, field)));
    },
    [visibleFields, dispatch, instance, sortable, sort],
  );

  return { onHeaderClicked };
}
