// src/features/dataGrid/DataGrid.tsx
import { DataEditor, type DataEditorRef, type Rectangle } from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import { useGridTheme } from "../../theme/useGridTheme";
import { specFromGridSort } from "./data/sortSpec";
import { useRowSync } from "./data/sync/useRowSync";
import type { DisplayModel } from "./displayModel";
import { GridStatusBar } from "./GridStatusBar";
import { sortHeaderIcons } from "./headerIcons";
import { useCellRenderer } from "./hooks/useCellRenderer";
import { useDisplayModel } from "./hooks/useDisplayModel";
import { useGridColumns } from "./hooks/useGridColumns";
import { useGridData } from "./hooks/useGridData";
import { useGridSelection } from "./hooks/useGridSelection";
import { useGridSort } from "./hooks/useGridSort";
import { useRepaintRows } from "./hooks/useRepaintRows";
import { useWindowRange, type RangeLoaded } from "./hooks/useWindowRange";
import type { GridInstance } from "./types";
import { useGridDispatch } from "./useGridDispatch";

export function DataGrid<TRow extends object, TGroup, TKey extends string | number = number>({
  instance,
}: {
  instance: GridInstance<TRow, TGroup, TKey>;
}) {
  const gridRef = useRef<DataEditorRef>(null);

  // `repaintRows` translates a data index into the display row glide draws it
  // at, and it is created before the model exists in this render. It reads the
  // model back out of this cell, which the publish below keeps current.
  const modelRef = useRef<DisplayModel<TGroup> | null>(null);

  // The same arrangement for the columns. A repaint damages every VISIBLE
  // column of a changed row, and the column set is built after `repaintRows` in
  // this render — and rebuilt whenever the user hides or shows a column.
  const columnCountRef = useRef<number | null>(null);

  // And once more, for the one question `useWindowRange` cannot answer itself:
  // has the store already got this window. The predicate comes out of
  // `useGridData`, which needs the range this hook produces, so the two can
  // only meet over time — in the callback glide fires after both have run.
  const rangeLoadedRef = useRef<RangeLoaded | null>(null);

  const gridTheme = useGridTheme();
  const dispatch = useGridDispatch();
  const pageSize = instance.descriptor.pageSize ?? 100;

  const { sort, collapsedGroups } = useSelector((s: unknown) => instance.selectRoot(s).groups);
  const lastError = useSelector((s: unknown) => instance.selectRoot(s).edits.lastError);

  const spec = specFromGridSort(sort);

  // Rows repaint through glide's damage API, not through React. This callback
  // is the whole no-flash mechanism: rows already on screen are never
  // re-rendered, and the rows that just changed are the only ones redrawn.
  // All three writers share it — a page load, a settled save, and a pushed
  // update. See `hooks/useRepaintRows.ts`.
  const repaintRows = useRepaintRows(gridRef, modelRef, columnCountRef);

  // The range first, then the rows it loads, then the model they shape. Acyclic
  // per render: only the callback handed to glide closes the loop, over time.
  const { range, onRectChanged } = useWindowRange(pageSize, rangeLoadedRef);

  const { rowAt, isPending, isRangeLoaded, total, span, status, retry, isStale, overlay, store } =
    useGridData(instance, range, spec, collapsedGroups, repaintRows);

  // Published during render, like the model and the column count below it. The
  // predicate closes over the store the grid is reading NOW, and a window that
  // tested itself against the store of an earlier render would skip the settle
  // wait on pages a hold has since replaced.
  rangeLoadedRef.current = isRangeLoaded;

  const { visibleFields, columns, onColumnResize, onColumnMoved } = useGridColumns(instance);

  // Published during render, for the same reason the model is: a repaint that
  // ran against a stale count would either miss a column the user has just
  // shown or name one the grid no longer draws.
  columnCountRef.current = columns.length;

  const { model, onHeaderOrCellClicked } = useDisplayModel(instance, { total, span });

  // A group collapse or a grown span rebuilds the model, and every rebuild moves
  // which display row a data index sits at. Publishing it here, during render,
  // is what stops a repaint translating against a mapping the grid has already
  // stopped drawing.
  modelRef.current = model;
  const { gridSelection, onGridSelectionChange } = useGridSelection(instance, model, rowAt);
  const { onHeaderClicked } = useGridSort(instance, visibleFields);
  const { getCellContent, onCellEdited } = useCellRenderer(instance, {
    model,
    visibleFields,
    columnCount: columns.length,
    rowAt,
    isPending,
    overlay,
    store,
    repaint: repaintRows,
  });

  // The third writer of a row. A pushed update patches the store in place and
  // moves nothing React watches, so it reaches the screen through the same
  // damage callback the page loader and the save path use.
  useRowSync(instance, collapsedGroups, repaintRows);

  const dismissError = useCallback(
    () => dispatch(instance.actions.editErrorCleared()),
    [dispatch, instance],
  );

  const onVisibleRegionChanged = useCallback(
    (rect: Rectangle) => onRectChanged(model, rect),
    [onRectChanged, model],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      <GridStatusBar
        status={status}
        error={lastError?.message ?? null}
        rowCount={model.rowCount}
        stale={isStale}
        onRetry={retry}
        onDismissError={dismissError}
      />

      {/*
        Old rows with no signal read as a working grid. The dim, plus the line
        in the bar above, is what tells the truth about the rows below while the
        next sort or collapse state loads.
      */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          opacity: isStale ? 0.6 : 1,
          transition: "opacity 120ms ease-out",
        }}
      >
        <DataEditor
          ref={gridRef}
          theme={gridTheme}
          customRenderers={instance.descriptor.cells.customRenderers}
          headerIcons={sortHeaderIcons}
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
