// src/features/dataGrid/DataGrid.tsx
import { DataEditor, type DataEditorRef } from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { useRef } from "react";
import { useGridTheme } from "../../theme/useGridTheme";
import { useCellRenderer } from "./hooks/useCellRenderer";
import { useDisplayModel } from "./hooks/useDisplayModel";
import { useGridColumns } from "./hooks/useGridColumns";
import { useGridSelection } from "./hooks/useGridSelection";
import { useGridSort } from "./hooks/useGridSort";
import { useGridWindowing } from "./hooks/useGridWindowing";
import type { GridInstance } from "./types";

export function DataGrid<TRow, TGroup>({ instance }: { instance: GridInstance<TRow, TGroup> }) {
  const gridRef = useRef<DataEditorRef>(null);
  const gridTheme = useGridTheme();

  const { visibleFields, columns, onColumnResize, onColumnMoved } = useGridColumns(instance);
  const { model, onHeaderOrCellClicked } = useDisplayModel(instance);
  const { onVisibleRegionChanged, ensureWindow } = useGridWindowing(instance, model);
  const { gridSelection, onGridSelectionChange } = useGridSelection(instance, model);
  const { onHeaderClicked } = useGridSort(instance, visibleFields);
  const { getCellContent, onCellEdited } = useCellRenderer(instance, {
    model,
    visibleFields,
    columnCount: columns.length,
    ensureWindow,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <DataEditor
          ref={gridRef}
          theme={gridTheme}
          customRenderers={instance.descriptor.cells.customRenderers}
          validateCell={(_cell, newValue) => instance.descriptor.cells.validateCell(newValue)}
          columns={columns}
          rows={model.rowCount}
          getCellContent={getCellContent}
          onCellEdited={onCellEdited}
          onCellClicked={onHeaderOrCellClicked}
          onVisibleRegionChanged={onVisibleRegionChanged}
          onColumnResize={onColumnResize}
          onColumnMoved={onColumnMoved}
          rowMarkers="checkbox-visible"
          gridSelection={gridSelection}
          onGridSelectionChange={onGridSelectionChange}
          onHeaderClicked={onHeaderClicked}
          width="100%"
          height="100%"
          smoothScrollX
          smoothScrollY
        />
      </div>
    </div>
  );
}
