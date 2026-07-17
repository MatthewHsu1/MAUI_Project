// src/features/dataGrid/hooks/useGridWindowing.ts
import type { Rectangle } from "@glideapps/glide-data-grid";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { displayToData, groupOfDataIndex, type DisplayModel } from "../displayModel";
import type { GridInstance } from "../types";
import { useGridDispatch } from "../useGridDispatch";

export function useGridWindowing<TRow, TGroup>(
  instance: GridInstance<TRow, TGroup>,
  model: DisplayModel<TGroup>,
): {
  ensureWindow: (dataIndex: number) => void;
  onVisibleRegionChanged: (range: Rectangle) => void;
  topGroup: TGroup | null;
} {
  const dispatch = useGridDispatch();
  const pageSize = instance.descriptor.pageSize ?? 100;
  const { byIndex, loadingWindows, total } = useSelector(
    (s: unknown) => instance.selectRoot(s).gridData,
  );
  const [topGroup, setTopGroup] = useState<TGroup | null>(null);

  useEffect(() => {
    if (total === 0) {
      dispatch(instance.thunks.fetchWindow({ skip: 0, take: pageSize }));
    }
  }, [dispatch, instance, total, pageSize]);

  const ensureWindow = useCallback(
    (dataIndex: number) => {
      const start = Math.floor(dataIndex / pageSize) * pageSize;

      if (byIndex[start] === undefined && !loadingWindows[start]) {
        dispatch(instance.thunks.fetchWindow({ skip: start, take: pageSize }));
      }
    },
    [byIndex, loadingWindows, dispatch, instance, pageSize],
  );

  const onVisibleRegionChanged = useCallback(
    (range: Rectangle) => {
      const firstCell = displayToData(model, range.y);
      const lastCell = displayToData(model, range.y + range.height);

      if (firstCell.kind === "data") ensureWindow(firstCell.dataIndex);
      if (lastCell.kind === "data") ensureWindow(lastCell.dataIndex);

      const topCell = displayToData(model, range.y);
      const g =
        topCell.kind === "header" ? topCell.group : groupOfDataIndex(model, topCell.dataIndex);

      setTopGroup(g);
    },
    [model, ensureWindow],
  );

  return { ensureWindow, onVisibleRegionChanged, topGroup };
}
