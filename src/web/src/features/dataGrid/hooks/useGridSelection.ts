// src/features/dataGrid/hooks/useGridSelection.ts
import { CompactSelection, type GridSelection } from "@glideapps/glide-data-grid";
import { useCallback, useState } from "react";
import { displayToData, type DisplayModel } from "../displayModel";
import type { GridInstance } from "../types";
import { useGridDispatch } from "../useGridDispatch";

export function useGridSelection<
  TRow extends object,
  TGroup,
  TKey extends string | number = number,
>(
  instance: GridInstance<TRow, TGroup, TKey>,
  model: DisplayModel<TGroup>,
  rowAt: (dataIndex: number) => TRow | undefined,
): {
  gridSelection: GridSelection;
  onGridSelectionChange: (sel: GridSelection) => void;
} {
  const dispatch = useGridDispatch();
  const { rowKey } = instance.descriptor;

  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const onGridSelectionChange = useCallback(
    (sel: GridSelection) => {
      setGridSelection(sel);

      const ids: TKey[] = [];

      sel.rows.toArray().forEach((displayRow) => {
        const cell = displayToData(model, displayRow);

        if (cell.kind !== "data") return;

        const row = rowAt(cell.dataIndex);

        if (row) ids.push(rowKey(row));
      });

      dispatch(instance.actions.setSelectedIds(ids));
    },
    [model, rowAt, dispatch, instance, rowKey],
  );

  return { gridSelection, onGridSelectionChange };
}
