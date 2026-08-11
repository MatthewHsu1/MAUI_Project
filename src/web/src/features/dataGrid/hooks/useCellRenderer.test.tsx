// src/features/dataGrid/hooks/useCellRenderer.test.tsx
import { GridCellKind, type EditableGridCell, type GridCell } from "@glideapps/glide-data-grid";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { createEditOverlay } from "../data/editOverlay";
import { createRowStore, MAX_LOADED_PAGES } from "../data/rowStore";
import { buildFlatModel } from "../displayModel";
import { createEditsSlice } from "../store/editsSlice";
import type { GridInstance } from "../types";
import { useCellRenderer } from "./useCellRenderer";

interface Row {
  id: number;
  name: string;
}

const ROW_A: Row = { id: 1, name: "a" };
const ROW_B: Row = { id: 2, name: "b" };

const typed: EditableGridCell = {
  kind: GridCellKind.Text,
  data: "typed",
  displayData: "typed",
  allowOverlay: true,
};

interface HarnessOptions {
  /** Rejects every save, the way the api does when it answers `{ ok: false }`. */
  rejectSave?: boolean;

  /** A theme the cell type itself supplies, independent of the pending grey. */
  cellTheme?: Record<string, string>;
}

function makeHarness({ rejectSave = false, cellTheme }: HarnessOptions = {}) {
  // Which keys reject their save. Per key and mutable, so one harness can fail
  // one cell's save and accept another's — the sequence the cell identity on
  // `lastError` exists for.
  const rejecting = new Set<number>(rejectSave ? [ROW_A.id, ROW_B.id] : []);

  // A gate the test opens, so a save can be held in flight while the pending
  // tint is read off the cell.
  let openSaves: () => void = () => {};
  let gate: Promise<void> = Promise.resolve();

  const rowsByKey = (id: number): Row => (id === ROW_A.id ? ROW_A : ROW_B);

  const updateRow = vi.fn(async ({ id, changes }: { id: number; changes: Partial<Row> }) => {
    await gate;

    if (rejecting.has(id)) {
      return { ok: false };
    }

    return { ok: true, row: { ...rowsByKey(id), ...changes } };
  });

  const rowStore = createRowStore<Row, number>(100, (r) => r.id);
  rowStore.writePage(0, [ROW_A, ROW_B]);

  const overlay = createEditOverlay<Row, number>();

  // Stands in for `DataGrid`'s `updateCells` call. A settled save changes no
  // state React or glide watches, so this callback is the ONLY thing that
  // redraws the cell.
  const repaint = vi.fn();

  const edits = createEditsSlice("demo");
  const store = configureStore({
    reducer: { demo: combineReducers({ edits: edits.reducer }) },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  });
  const lastError = () => store.getState().demo.edits.lastError;

  const instance = {
    descriptor: {
      rowKey: (r: Row) => r.id,
      columns: {
        defs: {
          name: { field: "name", title: "Name", defaultWidth: 80, editable: true, type: "text" },
        },
      },
      api: { updateRow },
      cells: {
        makeCell: (_type: string, raw: unknown): GridCell => ({
          kind: GridCellKind.Text,
          data: String(raw),
          displayData: String(raw),
          allowOverlay: true,
          ...(cellTheme ? { themeOverride: cellTheme } : {}),
        }),
      },
    },
    actions: edits.actions,
  } as unknown as GridInstance<Row, never, number>;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  const { result } = renderHook(
    () =>
      useCellRenderer(instance, {
        model: buildFlatModel(2),
        visibleFields: ["name"],
        columnCount: 1,
        rowAt: (dataIndex: number) => {
          const row = rowStore.getRow(dataIndex);

          if (row === undefined) {
            return undefined;
          }

          return overlay.apply(row.id, row);
        },
        isPending: (key: number) => overlay.isPending(key),
        overlay,
        store: rowStore,
        repaint,
      }),
    { wrapper },
  );

  const acceptSave = (key: number) => rejecting.delete(key);

  const holdSaves = () => {
    gate = new Promise<void>((resolve) => {
      openSaves = resolve;
    });
  };

  const releaseSaves = () => openSaves();

  /**
   * Pushes page 0 out of the store under the real eviction cap, the way a scroll
   * to a far window does. It writes one row per page so the arrange step stays
   * cheap; only the page COUNT decides what is evicted.
   */
  const evictFirstPage = () => {
    for (let page = 1; page <= MAX_LOADED_PAGES; page += 1) {
      rowStore.writePage(page, [{ id: 1_000 + page, name: `far-${page}` }]);
    }
  };

  return {
    instance,
    updateRow,
    result,
    lastError,
    acceptSave,
    holdSaves,
    releaseSaves,
    evictFirstPage,
    repaint,
    rowStore,
    overlay,
  };
}

describe("useCellRenderer", () => {
  it("renders a row whose edit is still in flight differently from a settled one", () => {
    const { result, overlay } = makeHarness();

    // The overlay is the only signal that an edit has not landed yet, and it is
    // silent when it breaks. So assert both sides: the settled cell must carry
    // NO override, the pending one must.
    overlay.begin(ROW_B.id, "name", "typed");

    const settled = result.current.getCellContent([0, 0]);
    const pending = result.current.getCellContent([0, 1]);

    expect(settled.themeOverride).toBeUndefined();
    expect(pending.themeOverride).toEqual({ textDark: "#8a8a8a" });
    expect(pending).not.toEqual(settled);
  });

  it("keeps the cell's own theme and its edit flash while the save is pending", () => {
    // The pending grey is one key on `themeOverride`, not the whole object: a
    // cell type that themes itself (a status colour, say) must keep that theme
    // on the one cell being saved, and `lastUpdated` — the edit flash — must
    // survive the same round trip.
    const h = makeHarness({ cellTheme: { bgCell: "#ffeeee" } });

    h.holdSaves();
    h.result.current.onCellEdited([0, 1], typed);

    const cell = h.result.current.getCellContent([0, 1]);

    expect(cell.themeOverride).toEqual({ bgCell: "#ffeeee", textDark: "#8a8a8a" });
    expect(cell.lastUpdated).toBeDefined();

    h.releaseSaves();
  });

  it("shows the typed value before the server answers, then writes it into the store", async () => {
    const { result, rowStore, updateRow } = makeHarness();

    result.current.onCellEdited([0, 1], typed);

    // Optimistic: the overlay answers straight away, and the store still holds
    // server truth.
    expect(result.current.getCellContent([0, 1])).toMatchObject({ displayData: "typed" });
    expect(rowStore.getRow(1)?.name).toBe("b");

    expect(updateRow).toHaveBeenCalledTimes(1);
    expect(updateRow.mock.calls[0][0]).toEqual({ id: ROW_B.id, changes: { name: "typed" } });

    // Settled: the server's row lands in the store and the overlay lets go.
    await waitFor(() => expect(rowStore.getRow(1)?.name).toBe("typed"));
    expect(result.current.getCellContent([0, 1])).toMatchObject({ displayData: "typed" });
  });

  it("reports a rejected save as an error instead of losing it", async () => {
    const { result, lastError } = makeHarness({ rejectSave: true });
    expect(lastError()).toBeNull();

    result.current.onCellEdited([0, 1], typed);

    // The `cell` is the ROW KEY and the field, not the display row or the data
    // index: display row 1 holds row id 2.
    await waitFor(() =>
      expect(lastError()).toEqual({ cell: "2:name", message: "Failed to save name" }),
    );
  });

  it("drops the optimistic value when the save is rejected", async () => {
    const { result, rowStore } = makeHarness({ rejectSave: true });

    result.current.onCellEdited([0, 1], typed);

    await waitFor(() =>
      expect(result.current.getCellContent([0, 1])).toMatchObject({ displayData: "b" }),
    );

    // The rollback is a delete from the overlay, never a restore into the
    // store — the store never held the typed value at all.
    expect(rowStore.getRow(1)?.name).toBe("b");
  });

  it("reports a thrown save instead of throwing into glide", async () => {
    const { result, lastError, updateRow } = makeHarness();

    updateRow.mockImplementation(async () => {
      throw new Error("network");
    });

    expect(() => result.current.onCellEdited([0, 1], typed)).not.toThrow();

    await waitFor(() => expect(lastError()?.message).toBe("Failed to save name"));
  });

  it("clears the last error when the SAME cell saves successfully", async () => {
    const { result, lastError, acceptSave } = makeHarness({ rejectSave: true });

    result.current.onCellEdited([0, 1], typed);
    await waitFor(() => expect(lastError()?.cell).toBe("2:name"));

    acceptSave(ROW_B.id);
    result.current.onCellEdited([0, 1], typed);

    // A save that landed is proof the earlier failure on THAT cell no longer
    // describes the grid. Without a dispatch on success there is no other
    // producer to say so, so the message would outlive its subject for the life
    // of the page.
    await waitFor(() => expect(lastError()).toBeNull());
  });

  it("leaves one cell's error standing when a DIFFERENT cell saves successfully", async () => {
    const { result, lastError, acceptSave } = makeHarness({ rejectSave: true });

    // Cell B (display row 1, row id 2) fails.
    result.current.onCellEdited([0, 1], typed);
    await waitFor(() => expect(lastError()?.cell).toBe("2:name"));

    // Cell A (display row 0, row id 1) then succeeds. It says nothing about B,
    // and the user has been told nothing else about B — so B's message must
    // survive, or a failed save disappears unseen.
    acceptSave(ROW_A.id);
    result.current.onCellEdited([0, 0], typed);
    await new Promise((r) => setTimeout(r, 0));

    expect(lastError()).toEqual({ cell: "2:name", message: "Failed to save name" });
  });

  it("records no error when the save succeeds", async () => {
    const { result, lastError } = makeHarness();

    result.current.onCellEdited([0, 1], typed);
    await new Promise((r) => setTimeout(r, 0));

    expect(lastError()).toBeNull();
  });

  it("repaints the row when a save commits, because nothing else redraws it", async () => {
    const { result, repaint, rowStore } = makeHarness();

    result.current.onCellEdited([0, 1], typed);

    await waitFor(() => expect(rowStore.getRow(1)?.name).toBe("typed"));

    // Every input `getCellContent` reads is stable after mount, and glide
    // re-runs it only when its own draw inputs move. Without this damage call
    // the grey pending tint would sit on a cell that has already saved.
    expect(repaint).toHaveBeenCalledTimes(1);
    expect(repaint).toHaveBeenCalledWith([1]);
  });

  it("repaints the row when a save rolls back, so the rejected value leaves the screen", async () => {
    const { result, repaint, lastError } = makeHarness({ rejectSave: true });

    result.current.onCellEdited([0, 1], typed);

    await waitFor(() => expect(lastError()).not.toBeNull());

    // Without this the banner says the save failed while the cell still shows
    // the value the server rejected.
    expect(repaint).toHaveBeenCalledTimes(1);
    expect(repaint).toHaveBeenCalledWith([1]);
  });

  it("settles without error when the row's page left the store mid-save", async () => {
    // A window move, a sort change, or a pushed create can drop the row's page
    // while its save is in flight. The save still lands on the server, and the
    // grid must neither raise an error nor try to damage a cell that is not
    // there.
    const h = makeHarness();

    h.holdSaves();
    h.result.current.onCellEdited([0, 1], typed);

    h.evictFirstPage();
    expect(h.rowStore.indexOfKey(ROW_B.id)).toBeUndefined();

    h.releaseSaves();

    await waitFor(() => expect(h.overlay.isPending(ROW_B.id)).toBe(false));

    expect(h.lastError()).toBeNull();
    expect(h.repaint).not.toHaveBeenCalled();
  });

  it("ignores an edit to a read-only column", () => {
    // A fresh harness per test, so flipping this def affects nothing else.
    const { instance, updateRow, result } = makeHarness();
    instance.descriptor.columns.defs.name.editable = false;

    result.current.onCellEdited([0, 1], typed);

    expect(updateRow).not.toHaveBeenCalled();
  });
});
