import type { DataEditorRef } from "@glideapps/glide-data-grid";
import { useCallback } from "react";
import { displayRowsOfData, type DisplayModel } from "../displayModel";

/**
 * The part of glide's editor handle this hook uses.
 *
 * Narrowed to the one method, so a test can stand in for the editor without a
 * canvas and without the jsdom polyfills a real `DataEditor` mount needs.
 */
export type GridDamageTarget = Pick<DataEditorRef, "updateCells">;

/** A cell holding a value the caller replaces from outside this hook. */
interface Cell<T> {
  readonly current: T | null;
}

/**
 * The grid's one repaint callback, shared by every writer of a row.
 *
 * There are three writers. A page load hands it the indexes the store just
 * wrote, a settled save hands it the one row it touched, and a pushed update
 * hands it the row it patched. None of the three changes any state
 * `getCellContent` reads, and glide re-runs `getCellContent` only when its own
 * draw inputs move, so this damage call is the only thing that puts any of the
 * three on screen.
 *
 * `rowAt`, `store`, and `model` are NOT stable after mount — a hold that adopts
 * replaces all three, and that change of identity is exactly what makes the swap
 * itself repaint. But an adoption is a different event from a load, a save, or a
 * push, and between two adoptions none of the three reaches React at all. That
 * is the gap this callback fills.
 *
 * It is deliberately ONE callback: the three writers must not drift apart on
 * which coordinate space they damage in.
 *
 * That coordinate space is glide's, which is DISPLAY rows. All three writers
 * speak data indexes, so `displayRowsOfData` translates, and a group header
 * sitting above the changed rows shifts every one of them.
 *
 * EVERY VISIBLE COLUMN of a changed row is damaged, not one cell of it.
 * `updateCells` builds a `CellSet` of the `[col, row]` pairs it is handed, and
 * the cell renderer draws only the cells that set holds. A data cell carries no
 * span, so naming column 0 repaints column 0 and leaves the rest of the row as
 * it was last drawn. On a flat grid — where the memoised model keeps
 * `getCellContent` identical across a page load, so glide blits rather than
 * redrawing — that left a landed page showing one filled column beside a row of
 * loading skeletons.
 *
 * The allocation is bounded at ROWS × VISIBLE COLUMNS per call, and the largest
 * writer is a page load, which reports at most one page at a time. The bound is
 * therefore `pageSize × visible columns`: 700 entries for the bonds grid, at its
 * default page size of 100 over 7 columns. It is built, handed to glide, and
 * dropped — nothing here is retained between calls.
 *
 * The model and the column count arrive through cells rather than as arguments
 * for two reasons. The callback has to exist BEFORE either does — `useGridData`
 * takes it, and the model is built from what `useGridData` returns — and both
 * are rebuilt while the grid lives: the model whenever a group collapses or the
 * loaded span grows, the column count whenever a column is hidden or shown. A
 * captured copy of either would damage against a layout the grid has stopped
 * drawing.
 */
export function useRepaintRows<TGroup>(
  gridRef: Cell<GridDamageTarget>,
  modelRef: Cell<DisplayModel<TGroup>>,
  columnCountRef: Cell<number>,
): (dataIndexes: number[]) => void {
  return useCallback(
    (dataIndexes: number[]) => {
      const editor = gridRef.current;
      const model = modelRef.current;
      const columnCount = columnCountRef.current;

      // No grid is mounted, or no model has been published yet. There is
      // nothing on screen for this write to correct.
      if (editor === null || model === null) {
        return;
      }

      // No column has been published yet, or the user has hidden every one of
      // them. Either way no cell of these rows is drawn, so there is nothing to
      // damage.
      if (columnCount === null || columnCount <= 0) {
        return;
      }

      const displayRows = displayRowsOfData(model, dataIndexes);

      // Every index was a row the model does not place — a collapsed group, or
      // a page past the current total. Damaging nothing is the correct answer.
      if (displayRows.length === 0) {
        return;
      }

      const damage: { cell: readonly [number, number] }[] = [];

      for (const row of displayRows) {
        for (let column = 0; column < columnCount; column += 1) {
          damage.push({ cell: [column, row] as const });
        }
      }

      editor.updateCells(damage);
    },
    [gridRef, modelRef, columnCountRef],
  );
}
