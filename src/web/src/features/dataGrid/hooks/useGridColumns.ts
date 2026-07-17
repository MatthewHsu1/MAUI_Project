// src/features/dataGrid/hooks/useGridColumns.ts
import type { GridColumn } from "@glideapps/glide-data-grid";
import { useCallback, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { useGridDispatch } from "../useGridDispatch";
import type { GridInstance } from "../types";

export function useGridColumns<TRow, TGroup>(
  instance: GridInstance<TRow, TGroup>,
): {
  visibleFields: string[];
  columns: GridColumn[];
  onColumnResize: (col: GridColumn, newSize: number, colIndex: number) => void;
  onColumnMoved: (from: number, to: number) => void;
} {
  const dispatch = useGridDispatch();
  const defs = instance.descriptor.columns.defs;
  const { order, widths, hidden } = useSelector((s: unknown) => instance.selectRoot(s).columns);

  useEffect(() => {
    dispatch(instance.thunks.loadColumns());
  }, [dispatch, instance]);

  const visibleFields = useMemo(() => order.filter((f) => !hidden.includes(f)), [order, hidden]);

  const columns: GridColumn[] = useMemo(
    () =>
      visibleFields.map((f) => ({
        id: f,
        title: defs[f].title,
        width: widths[f] ?? defs[f].defaultWidth,
      })),
    [visibleFields, widths, defs],
  );

  const onColumnResize = useCallback(
    (_col: GridColumn, newSize: number, colIndex: number) => {
      dispatch(instance.actions.resizeColumn({ field: visibleFields[colIndex], width: newSize }));
    },
    [dispatch, instance, visibleFields],
  );

  const onColumnMoved = useCallback(
    (from: number, to: number) => {
      dispatch(
        instance.actions.moveColumn({
          from: order.indexOf(visibleFields[from]),
          to: order.indexOf(visibleFields[to]),
        }),
      );
    },
    [dispatch, instance, order, visibleFields],
  );

  return { visibleFields, columns, onColumnResize, onColumnMoved };
}
