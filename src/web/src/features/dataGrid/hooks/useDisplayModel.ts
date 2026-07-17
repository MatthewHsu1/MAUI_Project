// src/features/dataGrid/hooks/useDisplayModel.ts
import type { Item } from "@glideapps/glide-data-grid";
import { useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import {
  buildDisplayModel,
  buildFlatModel,
  displayToData,
  type DisplayModel,
} from "../displayModel";
import { useGridDispatch } from "../useGridDispatch";
import type { GridInstance } from "../types";

export function useDisplayModel<TRow, TGroup>(
  instance: GridInstance<TRow, TGroup>,
): {
  model: DisplayModel<TGroup>;
  onHeaderOrCellClicked: (cellIndex: Item) => void;
} {
  const dispatch = useGridDispatch();
  const grouping = instance.descriptor.grouping;
  const total = useSelector((s: unknown) => instance.selectRoot(s).gridData.total);
  const { boundaries, collapsedGroups, discoveredGroups } = useSelector(
    (s: unknown) => instance.selectRoot(s).groups,
  );

  const model = useMemo(
    () =>
      grouping
        ? buildDisplayModel(
            { boundaries, total, collapsedGroups, discoveredGroups },
            grouping.order,
          )
        : (buildFlatModel(total) as DisplayModel<TGroup>),
    [grouping, boundaries, total, collapsedGroups, discoveredGroups],
  );

  const onHeaderOrCellClicked = useCallback(
    (cellIndex: Item) => {
      const cell = displayToData(model, cellIndex[1]);
      if (cell.kind === "header") dispatch(instance.actions.toggleCollapse(cell.group));
    },
    [model, dispatch, instance],
  );

  return { model, onHeaderOrCellClicked };
}
