// src/features/dataGrid/hooks/useGridSelection.ts
import { CompactSelection, type GridSelection } from "@glideapps/glide-data-grid";
import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { displayToData, type DisplayModel } from "../displayModel";
import type { GridInstance } from "../types";
import { useGridDispatch } from "../useGridDispatch";

export function useGridSelection<TRow, TGroup>(
  instance: GridInstance<TRow, TGroup>,
  model: DisplayModel<TGroup>,
): {
  gridSelection: GridSelection;
  onGridSelectionChange: (sel: GridSelection) => void;
} {
  const dispatch = useGridDispatch();
  const { rowKey } = instance.descriptor;
  const byIndex = useSelector((s: unknown) => instance.selectRoot(s).gridData.byIndex);

  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const onGridSelectionChange = useCallback(
    (sel: GridSelection) => {
      setGridSelection(sel);

      const ids: number[] = [];

      sel.rows.toArray().forEach((displayRow) => {
        const cell = displayToData(model, displayRow);

        if (cell.kind !== "data") return;

        const row = byIndex[cell.dataIndex];

        if (row) ids.push(rowKey(row));
      });

      dispatch(instance.actions.setSelectedIds(ids));
    },
    [model, byIndex, dispatch, instance, rowKey],
  );

  return { gridSelection, onGridSelectionChange };
}
