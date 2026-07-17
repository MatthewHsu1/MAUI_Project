// src/features/dataGrid/hooks/useCellRenderer.ts
import {
  GridCellKind,
  type EditableGridCell,
  type GridCell,
  type Item,
} from "@glideapps/glide-data-grid";
import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useEditHighlight } from "../../../lib/grid/useEditHighlight";
import { displayToData, type DisplayModel } from "../displayModel";
import type { GridInstance } from "../types";
import { useGridDispatch } from "../useGridDispatch";

function extractEditedValue(newValue: EditableGridCell): unknown {
  if (newValue.kind === GridCellKind.Custom) {
    return (newValue.data as { value?: unknown }).value;
  }

  return "data" in newValue ? (newValue as { data: unknown }).data : undefined;
}

interface Args<TGroup> {
  model: DisplayModel<TGroup>;
  visibleFields: string[];
  columnCount: number;
  ensureWindow: (dataIndex: number) => void;
}

export function useCellRenderer<TRow, TGroup>(
  instance: GridInstance<TRow, TGroup>,
  { model, visibleFields, columnCount, ensureWindow }: Args<TGroup>,
): {
  getCellContent: (cell: Item) => GridCell;
  onCellEdited: (cell: Item, newValue: EditableGridCell) => void;
} {
  const dispatch = useGridDispatch();
  const { descriptor } = instance;
  const defs = descriptor.columns.defs;
  const byIndex = useSelector((s: unknown) => instance.selectRoot(s).gridData.byIndex);
  const { markEdited, withHighlight } = useEditHighlight();

  const getCellContent = useCallback(
    ([col, displayRow]: Item): GridCell => {
      const cell = displayToData(model, displayRow);
      const field = visibleFields[col];

      if (cell.kind === "header") {
        const label = descriptor.grouping?.label(cell.group) ?? "";

        return {
          kind: GridCellKind.Text,
          data: label,
          displayData: `▾ ${label}`,
          allowOverlay: false,
          span: [0, Math.max(0, columnCount - 1)],
          themeOverride: { bgCell: "#eef2f7", textDark: "#1d6fb8" },
        };
      }

      const row = byIndex[cell.dataIndex];

      if (row === undefined) {
        ensureWindow(cell.dataIndex);
        return { kind: GridCellKind.Loading, allowOverlay: false };
      }

      const def = defs[field];
      const raw = (row as unknown as Record<string, unknown>)[field];
      const built = descriptor.cells.makeCell(def.type, raw, {
        editable: def.editable,
        withTime: def.withTime ?? false,
      });

      return withHighlight(`${cell.dataIndex}:${field}`, built);
    },
    [model, visibleFields, columnCount, byIndex, ensureWindow, withHighlight, descriptor, defs],
  );

  const onCellEdited = useCallback(
    ([col, displayRow]: Item, newValue: EditableGridCell) => {
      const cell = displayToData(model, displayRow);
      if (cell.kind !== "data") return;

      const field = visibleFields[col];
      if (!defs[field].editable) return;

      const value = extractEditedValue(newValue);

      markEdited(`${cell.dataIndex}:${field}`);

      dispatch(instance.thunks.saveCellEdit({ dataIndex: cell.dataIndex, field, value }));
    },
    [model, visibleFields, dispatch, instance, markEdited, defs],
  );

  return { getCellContent, onCellEdited };
}
