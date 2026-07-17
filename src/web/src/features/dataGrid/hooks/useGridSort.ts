// src/features/dataGrid/hooks/useGridSort.ts
import { useCallback, useMemo } from "react";
import { useGridDispatch } from "../useGridDispatch";
import type { GridInstance } from "../types";

export function useGridSort<TRow, TGroup>(
  instance: GridInstance<TRow, TGroup>,
  visibleFields: string[],
): { onHeaderClicked: (colIndex: number) => void } {
  const dispatch = useGridDispatch();
  const { descriptor } = instance;
  const pageSize = descriptor.pageSize ?? 100;

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
      dispatch(instance.actions.setSort({ field, dir: "asc" }));
      dispatch(instance.thunks.fetchWindow({ skip: 0, take: pageSize }));
    },
    [visibleFields, dispatch, instance, sortable, pageSize],
  );

  return { onHeaderClicked };
}
