// src/features/dataGrid/hooks/useCellRenderer.ts
import {
  GridCellKind,
  type EditableGridCell,
  type GridCell,
  type Item,
} from "@glideapps/glide-data-grid";
import { useCallback, useRef } from "react";
import { useEditHighlight } from "../../../lib/grid/useEditHighlight";
import type { EditOverlay } from "../data/editOverlay";
import type { RowStore } from "../data/rowStore";
import { displayToData, type DisplayModel } from "../displayModel";
import type { GridDescriptor, GridInstance } from "../types";
import { useGridDispatch } from "../useGridDispatch";

const GROUP_HEADER_THEME = { bgCell: "#eef2f7", textDark: "#1d6fb8" };
const PENDING_TEXT = "#8a8a8a";

interface Args<TRow extends object, TGroup, TKey extends string | number> {
  model: DisplayModel<TGroup>;
  visibleFields: string[];
  columnCount: number;

  /** The row at a data index, with any in-flight edit already laid over it. */
  rowAt: (dataIndex: number) => TRow | undefined;

  /** Whether a row has a save in flight. Drives the grey tint. */
  isPending: (key: TKey) => boolean;

  /** Where an optimistic value lives until the server answers. */
  overlay: EditOverlay<TRow, TKey>;

  /**
   * Server truth. A committed save writes the server's row here.
   *
   * It changes identity whenever `useGridData` adopts a new sort or collapse
   * state, so a save in flight must re-read it rather than keep the one its own
   * render saw.
   */
  store: RowStore<TRow, TKey>;

  /**
   * Repaints the given data-row indexes through glide's damage API. It is the
   * SAME callback `useGridData` takes as `onRowsLoaded` and `useRowSync` takes
   * for a pushed update.
   *
   * A settled save changes no React state that `getCellContent` reads, and
   * glide re-runs `getCellContent` only when its own draw inputs move. So
   * without this call the rejected value stays on screen after a rollback and
   * the grey pending tint stays after a commit — hidden only by glide's own
   * 500 ms edit flash, and visible on any save slower than that.
   *
   * `rowAt`, `store`, and `model` DO change identity, but only when a hold
   * adopts, which is not something a save does. Between two adoptions a settled
   * save reaches React through nothing at all.
   */
  repaint: (indexes: number[]) => void;
}

/** Reports how a save ended. Exactly one of the two runs. */
interface SaveOutcome {
  succeeded: () => void;
  failed: () => void;
}

function extractEditedValue(newValue: EditableGridCell): unknown {
  if (newValue.kind === GridCellKind.Custom) {
    return (newValue.data as { value?: unknown }).value;
  }

  return "data" in newValue ? (newValue as { data: unknown }).data : undefined;
}

/** The full-width row that names a group and spans every column. */
function groupHeaderCell(label: string, columnCount: number): GridCell {
  return {
    kind: GridCellKind.Text,
    data: label,
    displayData: `▾ ${label}`,
    allowOverlay: false,
    span: [0, Math.max(0, columnCount - 1)],
    themeOverride: { ...GROUP_HEADER_THEME },
  };
}

/**
 * Greys the text of a cell whose save has not landed yet.
 *
 * MERGE, never replace: `withHighlight` puts its own theme on the cell it just
 * stamped, and that is the very cell being saved. A replaced override would
 * delete the edit flash exactly where it matters most.
 */
function withPendingTint(cell: GridCell): GridCell {
  return {
    ...cell,
    themeOverride: { ...cell.themeOverride, textDark: PENDING_TEXT },
  };
}

/**
 * Writes one optimistic cell value and reports the outcome.
 *
 * The overlay holds the typed value and the store keeps server truth, so a
 * rejection needs no saved copy: dropping the overlay entry restores the stored
 * row, and it stays correct even when a reload replaced that row in between.
 *
 * A rejected `{ ok: false }` and a thrown request are the same outcome to the
 * user, so both arms roll back and report. Nothing escapes into glide's event
 * handler.
 *
 * Every exit repaints the row. Neither `commit` nor `rollback` changes anything
 * React or glide watches, so the cell would otherwise keep painting the value
 * the save started with.
 */
async function saveCell<TRow extends object, TKey extends string | number>(
  {
    overlay,
    currentStore,
    updateRow,
    repaint,
  }: {
    overlay: EditOverlay<TRow, TKey>;
    /**
     * The store the grid is drawing RIGHT NOW, read at settle time.
     *
     * It is a function, not the store itself, because `useGridData` swaps the
     * displayed store when a new sort or collapse state is adopted. A save that
     * started before the swap would otherwise patch the discarded store, and the
     * user would watch the edit disappear with no error to explain it.
     */
    currentStore: () => RowStore<TRow, TKey>;
    updateRow: GridDescriptor<TRow, never, TKey>["api"]["updateRow"];
    repaint: (indexes: number[]) => void;
  },
  rowKey: TKey,
  field: string,
  value: unknown,
  { succeeded, failed }: SaveOutcome,
): Promise<void> {
  /**
   * Damages the saved row, if the store still holds it.
   *
   * `indexOfKey` answers undefined when the row's page was evicted while the
   * save was in flight, or when the adopted view does not hold this row at all
   * — a window move, a sort change, or a pushed create. There is then no cell on
   * screen showing this row, so there is nothing to repaint and nothing has gone
   * wrong: the window that comes back loads the row fresh.
   */
  const repaintRow = () => {
    const index = currentStore().indexOfKey(rowKey);

    if (index === undefined) {
      return;
    }

    repaint([index]);
  };

  overlay.begin(rowKey, field, value);

  try {
    const result = await updateRow({ id: rowKey, changes: { [field]: value } as Partial<TRow> });

    if (!result.ok) {
      overlay.rollback(rowKey, field);
      repaintRow();
      failed();

      return;
    }

    // Read now, not when the save started. `patchRow` answers undefined when
    // the store on screen does not hold this row, which writes nothing and is
    // the right answer: no cell shows it.
    const store = currentStore();

    // The server's row wins when it sends one, because a derived column may
    // have moved with the edit. Otherwise the typed value becomes truth.
    if (result.row) {
      store.patchRow(rowKey, result.row);
    } else {
      store.patchRow(rowKey, { [field]: value } as Partial<TRow>);
    }

    overlay.commit(rowKey, field);
    repaintRow();
    succeeded();
  } catch {
    overlay.rollback(rowKey, field);
    repaintRow();
    failed();
  }
}

export function useCellRenderer<TRow extends object, TGroup, TKey extends string | number = number>(
  instance: GridInstance<TRow, TGroup, TKey>,
  {
    model,
    visibleFields,
    columnCount,
    rowAt,
    isPending,
    overlay,
    store,
    repaint,
  }: Args<TRow, TGroup, TKey>,
): {
  getCellContent: (cell: Item) => GridCell;
  onCellEdited: (cell: Item, newValue: EditableGridCell) => void;
} {
  const dispatch = useGridDispatch();
  const { descriptor } = instance;
  const defs = descriptor.columns.defs;
  const { markEdited, withHighlight } = useEditHighlight();

  // `useGridData` hands a DIFFERENT store over when it adopts a new sort or
  // collapse state, and a save started before that swap settles after it. The
  // ref is what lets the settle path find the store now on screen instead of
  // the one this render captured.
  const storeRef = useRef(store);
  storeRef.current = store;

  const getCellContent = useCallback(
    ([col, displayRow]: Item): GridCell => {
      const cell = displayToData(model, displayRow);

      if (cell.kind === "header") {
        const label = descriptor.grouping?.label(cell.group) ?? "";

        return groupHeaderCell(label, columnCount);
      }

      const row = rowAt(cell.dataIndex);

      // No fetch starts here. The loaded range follows the visible region
      // (see useWindowRange); rendering stays a pure read.
      if (row === undefined) {
        return { kind: GridCellKind.Loading, allowOverlay: false };
      }

      const field = visibleFields[col];
      const def = defs[field];
      const raw = (row as unknown as Record<string, unknown>)[field];

      const built = descriptor.cells.makeCell(def.type, raw, {
        editable: def.editable,
        withTime: def.withTime ?? false,
      });

      const content = withHighlight(`${cell.dataIndex}:${field}`, built);

      return isPending(descriptor.rowKey(row)) ? withPendingTint(content) : content;
    },
    [model, visibleFields, columnCount, rowAt, isPending, withHighlight, descriptor, defs],
  );

  const onCellEdited = useCallback(
    ([col, displayRow]: Item, newValue: EditableGridCell) => {
      const cell = displayToData(model, displayRow);

      if (cell.kind !== "data") {
        return;
      }

      const field = visibleFields[col];

      if (!defs[field].editable) {
        return;
      }

      const value = extractEditedValue(newValue);

      markEdited(`${cell.dataIndex}:${field}`);

      const row = rowAt(cell.dataIndex);

      if (row === undefined) {
        return;
      }

      const rowKey = descriptor.rowKey(row);

      // The row KEY, not `cell.dataIndex`: a data index names a position, and a
      // reload can put a different row there while this save is in flight,
      // which would then let a success on one row clear another row's error.
      const cellId = `${String(rowKey)}:${field}`;

      // Success retracts the message, but only its OWN. Both arms carry the
      // same `cellId`, and the slice clears on a match, so a success on one
      // cell cannot erase a failure the user has not seen answered on another.
      // The overlay already carries "this cell is not saved yet", so nothing
      // here re-states it.
      void saveCell(
        {
          overlay,
          currentStore: () => storeRef.current,
          updateRow: descriptor.api.updateRow,
          repaint,
        },
        rowKey,
        field,
        value,
        {
          succeeded: () => dispatch(instance.actions.editSucceeded(cellId)),
          failed: () =>
            dispatch(
              instance.actions.editFail({ cell: cellId, message: `Failed to save ${field}` }),
            ),
        },
      );
    },
    [
      model,
      visibleFields,
      instance,
      descriptor,
      rowAt,
      markEdited,
      defs,
      dispatch,
      overlay,
      storeRef,
      repaint,
    ],
  );

  return { getCellContent, onCellEdited };
}
