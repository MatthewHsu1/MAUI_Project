import {
  GridCellKind,
  type EditableGridCell,
  type GridCell,
  type Rectangle,
} from "@glideapps/glide-data-grid";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { Provider, useSelector } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { specFromGridSort } from "./data/sortSpec";
import { PUSH_BUFFER_MS, useRowSync } from "./data/sync/useRowSync";
import { displayToData, type DisplayModel } from "./displayModel";
import { useCellRenderer } from "./hooks/useCellRenderer";
import { useDisplayModel } from "./hooks/useDisplayModel";
import { useGridData } from "./hooks/useGridData";
import { useRepaintRows, type GridDamageTarget } from "./hooks/useRepaintRows";
import { useWindowRange, type RangeLoaded } from "./hooks/useWindowRange";
import { createGridInstance } from "./store/createGridInstance";
import { createFakeRowServer } from "./testing/fakeRowServer";
import type { GridDescriptor, GridInstance } from "./types";

interface Row {
  id: number;
  name: string;
  g: number;
}

const PAGE = 100;

/** Rows 0-59 are group 0, 60-119 group 1, and so on. */
const GROUP_SIZE = 60;

/**
 * Visible columns. More than one on purpose: a repaint has to damage the whole
 * ROW, and a one-column grid cannot tell "every visible column" apart from
 * "column 0".
 */
const VISIBLE_FIELDS = ["name", "g"];

function textCell(_type: string, raw: unknown): GridCell {
  const text = String(raw ?? "");

  return { kind: GridCellKind.Text, data: text, displayData: text, allowOverlay: true };
}

function cellText(cell: GridCell): string {
  if (cell.kind === GridCellKind.Text) {
    return cell.displayData;
  }

  return `<${cell.kind}>`;
}

const typedCell: EditableGridCell = {
  kind: GridCellKind.Text,
  data: "typed",
  displayData: "typed",
  allowOverlay: true,
};

/**
 * The hooks wired exactly as `DataGrid` wires them, minus the `DataEditor`: a
 * real glide mount needs jsdom polyfills this project does not carry
 * (ResizeObserver, canvas), so the cells are read through `getCellContent`
 * directly and the damage calls are read off a stand-in editor. Both are the
 * same functions glide would call, given the same display index, so nothing
 * about the assertion is weaker.
 *
 * `useRepaintRows` is the REAL hook `DataGrid` uses, wired in the same order and
 * with the same model publish, so the coordinate space these cases assert on is
 * the production one rather than a copy of it.
 */
function useComposedGrid(
  instance: GridInstance<Row, number, number>,
  gridRef: { current: GridDamageTarget | null },
) {
  const { sort, collapsedGroups } = useSelector((s: unknown) => instance.selectRoot(s).groups);

  const spec = specFromGridSort(sort);
  const rangeLoadedRef = useRef<RangeLoaded | null>(null);
  const { range, onRectChanged } = useWindowRange(PAGE, rangeLoadedRef);

  const modelRef = useRef<DisplayModel<number> | null>(null);
  const columnCountRef = useRef<number | null>(VISIBLE_FIELDS.length);
  const repaint = useRepaintRows(gridRef, modelRef, columnCountRef);

  const { rowAt, isPending, isRangeLoaded, total, span, status, isStale, overlay, store } =
    useGridData(instance, range, spec, collapsedGroups, repaint);

  rangeLoadedRef.current = isRangeLoaded;

  const { model } = useDisplayModel(instance, { total, span });

  modelRef.current = model;

  const { getCellContent, onCellEdited } = useCellRenderer(instance, {
    model,
    visibleFields: VISIBLE_FIELDS,
    columnCount: VISIBLE_FIELDS.length,
    rowAt,
    isPending,
    overlay,
    store,
    repaint,
  });

  // The push subscriber, wired exactly where `DataGrid` wires it, so a pushed
  // create or delete reaches the same hold a sort change takes — and a pushed
  // update reaches the same damage callback the loader and the save path use.
  useRowSync(instance, collapsedGroups, repaint);

  return {
    rowAt,
    total,
    status,
    isStale,
    span,
    model,
    store,
    getCellContent,
    onCellEdited,
    onVisibleRegionChanged: (rect: Rectangle) => onRectChanged(model, rect),
  };
}

interface HarnessOptions {
  /**
   * Adds `descriptor.grouping`, so the display model carries group headers and
   * a display index stops being a data index.
   */
  grouped?: boolean;
}

function makeHarness(total: number, { grouped = false }: HarnessOptions = {}) {
  const server = createFakeRowServer<Row, number, number>({
    rows: Array.from({ length: total }, (_, i) => ({
      id: i,
      name: `row-${i}`,
      g: Math.floor(i / GROUP_SIZE),
    })),
    rowKey: (r) => r.id,
    groupOf: (r) => r.g,
  });

  const updateRow = vi.fn(server.api.updateRow);

  // A gate around every page PAST the first, so a case can let page 0 settle on
  // its own and hold the rest of the window back.
  let openLaterPages: () => void = () => {};
  let laterPageGate: Promise<void> | null = null;

  // A gate per page offset, so a case can decide the exact order in which the
  // pages of ONE window land. Holding a hold half open is what exposes a push
  // that arrives between a pending page settling and the view adopting.
  const pageGates = new Map<number, { wait: Promise<void>; open: () => void }>();

  const fetchRows = vi.fn(async (p: Parameters<typeof server.api.fetchRows>[0]) => {
    if (laterPageGate !== null && p.offset > 0) {
      await laterPageGate;
    }

    const gate = pageGates.get(p.offset);

    if (gate !== undefined) {
      await gate.wait;
    }

    return server.api.fetchRows(p);
  });

  const descriptor = {
    name: "demo",
    rowKey: (r: Row) => r.id,
    pageSize: PAGE,
    columns: {
      defs: {
        name: { field: "name", title: "Name", defaultWidth: 120, editable: true, type: "text" },
        g: { field: "g", title: "Group", defaultWidth: 80, editable: false, type: "text" },
      },
      defaultOrder: VISIBLE_FIELDS,
    },
    grouping: grouped
      ? { field: "g", of: (r: Row) => r.g, order: (g: number) => g, label: String }
      : undefined,
    api: { ...server.api, updateRow, fetchRows },
    cells: { makeCell: textCell, customRenderers: [], validateCell: () => true },
  } as unknown as GridDescriptor<Row, number, number>;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });

  const instance = createGridInstance(descriptor);

  const store = configureStore({
    reducer: { demo: instance.reducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>{children}</Provider>
    </QueryClientProvider>
  );

  const updateCells = vi.fn();
  const gridRef: { current: GridDamageTarget | null } = {
    current: { updateCells } as unknown as GridDamageTarget,
  };

  return {
    server,
    instance,
    store,
    wrapper,
    updateRow,
    fetchRows,
    updateCells,
    gridRef,

    /** Every display row glide was asked to redraw, in call order. */
    damaged: () =>
      updateCells.mock.calls.flatMap((call) =>
        (call[0] as { cell: readonly [number, number] }[]).map((entry) => entry.cell[1]),
      ),

    /**
     * Every `[column, display row]` pair glide was asked to redraw, in call
     * order.
     *
     * Glide damages the CELLS it is named and nothing else — `updateCells`
     * builds a `CellSet` of these pairs, and the cell renderer skips any cell
     * the set does not hold. A data cell carries no span, so a row is only
     * repainted when every one of its visible columns is named.
     */
    damagedCells: () =>
      updateCells.mock.calls.flatMap((call) =>
        (call[0] as { cell: readonly [number, number] }[]).map((entry) => [
          entry.cell[0],
          entry.cell[1],
        ]),
      ),

    /** The columns damaged for one display row, ascending and deduplicated. */
    columnsDamagedFor: (displayRow: number) => {
      const columns = updateCells.mock.calls
        .flatMap((call) => call[0] as { cell: readonly [number, number] }[])
        .filter((entry) => entry.cell[1] === displayRow)
        .map((entry) => entry.cell[0]);

      return [...new Set(columns)].sort((a, b) => a - b);
    },

    lastError: () => instance.selectRoot(store.getState()).edits.lastError,
    requested: () => fetchRows.mock.calls.map((c) => ({ offset: c[0].offset, limit: c[0].limit })),

    holdLaterPages() {
      laterPageGate = new Promise<void>((resolve) => {
        openLaterPages = resolve;
      });
    },

    releaseLaterPages() {
      openLaterPages();
      laterPageGate = null;
    },

    /** Blocks every later request for the page starting at this offset. */
    holdPage(offset: number) {
      let open: () => void = () => {};
      const wait = new Promise<void>((resolve) => {
        open = resolve;
      });

      pageGates.set(offset, { wait, open });
    },

    releasePage(offset: number) {
      pageGates.get(offset)?.open();
      pageGates.delete(offset);
    },
  };
}

/** Long enough for a released page to resolve and reach the store. */
const settleTick = () => act(() => new Promise((r) => setTimeout(r, 30)));

/** Long enough for one push buffer to close and its flush to finish. */
const flushPush = () => act(() => new Promise((r) => setTimeout(r, PUSH_BUFFER_MS + 60)));

/** Glide reports the region in display rows; `height` is a row count. */
const scrollTo = (y: number): Rectangle => ({ x: 0, y, width: 5, height: 20 });

/** Whether the model draws a header row for a group. */
function hasHeaderFor<TGroup>(model: DisplayModel<TGroup>, group: TGroup): boolean {
  for (let display = 0; display < model.rowCount; display += 1) {
    const cell = displayToData(model, display);

    if (cell.kind === "header" && cell.group === group) {
      return true;
    }
  }

  return false;
}

describe("the composed grid, on a row store", () => {
  it("serves data index 999,700 of 1,000,000 with narrow page requests", async () => {
    const h = makeHarness(1_000_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.total).toBe(1_000_000), { timeout: 10_000 });
    await waitFor(() => expect(result.current.rowAt(0)).toBeDefined(), { timeout: 10_000 });

    act(() => result.current.onVisibleRegionChanged(scrollTo(999_800)));

    await waitFor(() => expect(result.current.rowAt(999_800)).toBeDefined(), { timeout: 10_000 });

    expect(cellText(result.current.getCellContent([0, 999_800]))).toBe("row-999800");
    expect(result.current.model.rowCount).toBe(1_000_000);

    for (const request of h.requested()) {
      expect(request.limit).toBe(PAGE);
    }
  }, 30_000);

  it("commits a scroll back onto cached rows with no settle wait", async () => {
    const h = makeHarness(100_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(0)).toBeDefined(), { timeout: 10_000 });

    // Walk forward two windows so pages 0, 1, 2 and 3 all reach the store.
    act(() => result.current.onVisibleRegionChanged(scrollTo(150)));
    await waitFor(() => expect(result.current.rowAt(250)).toBeDefined(), { timeout: 10_000 });

    act(() => result.current.onVisibleRegionChanged(scrollTo(250)));
    await waitFor(() => expect(result.current.rowAt(350)).toBeDefined(), { timeout: 10_000 });

    expect(result.current.span.offset).toBe(100);

    const before = h.requested().length;

    // Back onto pages the store already holds. No timer advanced, and nothing
    // awaited: the assertion runs on the same tick the scroll arrived.
    act(() => result.current.onVisibleRegionChanged(scrollTo(150)));

    expect(result.current.span.offset).toBe(0);

    // And it stayed free. A cached window commits precisely because it asks
    // the server for nothing.
    expect(h.requested().length).toBe(before);
  }, 30_000);

  it("still holds a scroll into cold rows for the settle wait", async () => {
    const h = makeHarness(100_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(0)).toBeDefined(), { timeout: 10_000 });

    // Rows nothing has loaded. The window must not move on this tick.
    act(() => result.current.onVisibleRegionChanged(scrollTo(50_000)));

    expect(result.current.span.offset).toBe(0);

    await waitFor(() => expect(result.current.span.offset).toBe(49_900), { timeout: 10_000 });
  }, 30_000);

  it("does NOT blank a loaded row when the window moves — the flash regression", async () => {
    const h = makeHarness(100_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(0)).toBeDefined(), { timeout: 10_000 });
    expect(cellText(result.current.getCellContent([0, 5]))).toBe("row-5");

    act(() => result.current.onVisibleRegionChanged(scrollTo(150)));

    // Sampled repeatedly across the whole window move. Row 5 must never once
    // read as a loading cell.
    for (let i = 0; i < 20; i += 1) {
      expect(cellText(result.current.getCellContent([0, 5]))).toBe("row-5");
      await act(() => new Promise((r) => setTimeout(r, 15)));
    }

    await waitFor(() => expect(result.current.rowAt(200)).toBeDefined(), { timeout: 10_000 });
    expect(cellText(result.current.getCellContent([0, 5]))).toBe("row-5");
  }, 30_000);

  it("shows an edit at once and keeps it when the server accepts", async () => {
    const h = makeHarness(1_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(5)).toBeDefined(), { timeout: 10_000 });

    act(() => result.current.onCellEdited([0, 5], typedCell));

    expect(cellText(result.current.getCellContent([0, 5]))).toBe("typed");

    await waitFor(() => expect(h.updateRow).toHaveBeenCalled());
    await waitFor(() => expect(cellText(result.current.getCellContent([0, 5]))).toBe("typed"));

    expect(h.lastError()).toBeNull();

    // This grid has no grouping, so a display row IS a data index and the
    // translation must be the identity. The settled save damaged row 5.
    expect(h.damaged()).toContain(5);
  }, 30_000);

  it("rolls the cell back and reports the failure when the server rejects", async () => {
    const h = makeHarness(1_000);
    h.updateRow.mockImplementation(async () => ({ ok: false }));

    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(5)).toBeDefined(), { timeout: 10_000 });

    act(() => result.current.onCellEdited([0, 5], typedCell));

    expect(cellText(result.current.getCellContent([0, 5]))).toBe("typed");

    await waitFor(() => expect(cellText(result.current.getCellContent([0, 5]))).toBe("row-5"), {
      timeout: 10_000,
    });

    expect(h.lastError()?.message).toBe("Failed to save name");
  }, 30_000);

  it("rolls back when updateRow rejects outright, not only when it answers ok:false", async () => {
    const h = makeHarness(1_000);
    h.updateRow.mockImplementation(async () => {
      throw new Error("network");
    });

    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(5)).toBeDefined(), { timeout: 10_000 });

    act(() => result.current.onCellEdited([0, 5], typedCell));

    await waitFor(() => expect(cellText(result.current.getCellContent([0, 5]))).toBe("row-5"), {
      timeout: 10_000,
    });

    expect(h.lastError()?.message).toBe("Failed to save name");
  }, 30_000);

  it("keeps the viewport loaded when the sort changes, without another scroll", async () => {
    const TOTAL = 1_000;
    const h = makeHarness(TOTAL);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.total).toBe(TOTAL), { timeout: 10_000 });

    act(() => result.current.onVisibleRegionChanged(scrollTo(500)));
    await waitFor(() => expect(result.current.rowAt(505)).toBeDefined(), { timeout: 10_000 });

    // A header click changes the sort but not the scroll offset, and `total` is
    // unchanged, so glide's rect is identical and `onVisibleRegionChanged` never
    // fires again. Nothing else can ask for the viewport's rows.
    act(() => void h.store.dispatch(h.instance.actions.setSort({ field: "id", dir: "desc" })));

    await waitFor(
      () =>
        expect(result.current.rowAt(505)).toEqual(expect.objectContaining({ id: TOTAL - 1 - 505 })),
      { timeout: 10_000 },
    );
  }, 30_000);

  it("reloads the rows, not just the total, when a group collapses after mount", async () => {
    // The count rekeys on collapse on its own, so a grid that reloads only the
    // total would show the new total beside the old rows — wrong rows under a
    // total that excludes them.
    const TOTAL = 1_000;
    const h = makeHarness(TOTAL);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.total).toBe(TOTAL), { timeout: 10_000 });
    await waitFor(
      () => expect(result.current.rowAt(0)).toEqual(expect.objectContaining({ id: 0 })),
      {
        timeout: 10_000,
      },
    );

    act(() => void h.store.dispatch(h.instance.actions.toggleCollapse(0)));

    // The server hides group 0, so the total drops by one group's rows AND the
    // row at data index 0 becomes the first row of group 1.
    await waitFor(() => expect(result.current.total).toBe(TOTAL - GROUP_SIZE), { timeout: 10_000 });
    await waitFor(
      () =>
        expect(result.current.rowAt(0)).toEqual(expect.objectContaining({ id: GROUP_SIZE, g: 1 })),
      { timeout: 10_000 },
    );

    // Expanding again has to bring them back, or the reload is one-way.
    act(() => void h.store.dispatch(h.instance.actions.toggleCollapse(0)));

    await waitFor(() => expect(result.current.total).toBe(TOTAL), { timeout: 10_000 });
    await waitFor(
      () => expect(result.current.rowAt(0)).toEqual(expect.objectContaining({ id: 0 })),
      {
        timeout: 10_000,
      },
    );
  }, 30_000);
  it("draws the header of a group that opens past the window's first page", async () => {
    // `statusOf` answers "ready" as soon as the FIRST page of a window lands
    // and never moves again while pages 2 and 3 arrive. A span memo keyed on
    // `status` therefore freezes at 100 rows, and `useDisplayModel` reads every
    // group boundary out of `span.rows` — so the header of a group opening past
    // row 100 would not draw until the window moved. Cells stay right either
    // way, because `rowAt` reads the store.
    const h = makeHarness(1_000, { grouped: true });
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.total).toBe(1_000), { timeout: 10_000 });
    await waitFor(() => expect(result.current.span.rows.length).toBe(PAGE), { timeout: 10_000 });

    // Group 2 opens at row 120, past the first page. It cannot be known yet.
    expect(hasHeaderFor(result.current.model, 2)).toBe(false);

    // Widen to three pages, and hold the two new ones until page 0 has long
    // since settled — the exact order that makes `status` stop moving.
    h.holdLaterPages();
    act(() => result.current.onVisibleRegionChanged(scrollTo(150)));

    await waitFor(() => expect(h.requested().length).toBeGreaterThan(1), { timeout: 10_000 });

    h.releaseLaterPages();

    await waitFor(() => expect(result.current.span.rows.length).toBe(300), { timeout: 10_000 });
    await waitFor(() => expect(hasHeaderFor(result.current.model, 2)).toBe(true), {
      timeout: 10_000,
    });
  }, 30_000);
  it("damages the DISPLAY rows of a loaded page, not its data indexes", async () => {
    // Glide numbers what it draws — and what it damages — in display space, and
    // a group header occupies a display row. The page loader reports absolute
    // store indexes. Hand those straight to `updateCells` and the repaint lands
    // on some other row, or on a header, while the rows that just arrived stay
    // as they were.
    const h = makeHarness(1_000, { grouped: true });
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    // Page 0 first, so the model already carries the headers of groups 0 and 1
    // when the next page lands. Group 0 opens at row 0 and group 1 at row 60,
    // so two headers sit above data index 100.
    await waitFor(() => expect(result.current.rowAt(99)).toBeDefined(), { timeout: 10_000 });
    await waitFor(() => expect(hasHeaderFor(result.current.model, 1)).toBe(true), {
      timeout: 10_000,
    });

    h.updateCells.mockClear();

    // Widen the window so page 1 (data 100-199) loads.
    act(() => result.current.onVisibleRegionChanged(scrollTo(150)));
    await waitFor(() => expect(result.current.rowAt(199)).toBeDefined(), { timeout: 10_000 });

    const damaged = h.damaged();

    // Data 100 draws at display 102 and data 199 at display 201: two headers
    // above them, so the shift is 2 and an off-by-one cannot satisfy this.
    expect(damaged).toContain(102);
    expect(damaged).toContain(201);

    // The raw data indexes must NOT be damaged. 100 and 101 are display rows of
    // OTHER data rows (98 and 99), which this load did not change.
    expect(damaged).not.toContain(100);
    expect(damaged).not.toContain(101);
  }, 30_000);

  it("damages the DISPLAY row of a saved cell in a grouped grid", async () => {
    const h = makeHarness(1_000, { grouped: true });
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(65)).toBeDefined(), { timeout: 10_000 });
    await waitFor(() => expect(hasHeaderFor(result.current.model, 1)).toBe(true), {
      timeout: 10_000,
    });

    // Display row 67 holds data row 65: group 0's header, its 60 rows, then
    // group 1's header, then group 1's rows. The two differ by 2.
    expect(displayToData(result.current.model, 67)).toEqual({ kind: "data", dataIndex: 65 });

    h.updateCells.mockClear();

    act(() => result.current.onCellEdited([0, 67], typedCell));

    await waitFor(() => expect(h.updateRow).toHaveBeenCalled());
    await waitFor(() => expect(h.damaged().length).toBeGreaterThan(0), { timeout: 10_000 });

    // `store.indexOfKey` answers 65. The damage must be display row 67, and no
    // other row may be damaged at all.
    expect(new Set(h.damaged())).toEqual(new Set([67]));
    expect(cellText(result.current.getCellContent([0, 67]))).toBe("typed");
  }, 30_000);

  it("damages every visible column of a loaded page, not column 0 alone", async () => {
    // Glide redraws exactly the cells `updateCells` names: it builds a
    // `CellSet` of the `[col, row]` pairs, and the cell renderer skips every
    // cell outside it. A data cell carries no span, so column 0 does not pull
    // its row with it.
    //
    // This grid is FLAT, which is the case that made the defect visible. One
    // memoised model keeps `getCellContent` identical across a page load, so
    // glide blits instead of redrawing and this damage call is the only repaint
    // there is. Name column 0 alone and a landed page shows one filled column
    // beside a row of loading skeletons.
    const h = makeHarness(1_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(99)).toBeDefined(), { timeout: 10_000 });

    h.updateCells.mockClear();

    // Widen the window so page 1 (data 100-199) loads. The grid is flat, so a
    // display row IS a data index.
    act(() => result.current.onVisibleRegionChanged(scrollTo(150)));
    await waitFor(() => expect(result.current.rowAt(199)).toBeDefined(), { timeout: 10_000 });

    expect(h.columnsDamagedFor(100)).toEqual([0, 1]);
    expect(h.columnsDamagedFor(150)).toEqual([0, 1]);
    expect(h.columnsDamagedFor(199)).toEqual([0, 1]);

    // No column outside the visible set. A damage entry for a column the grid
    // does not draw is work glide does for nothing.
    for (const [column] of h.damagedCells()) {
      expect(column).toBeLessThan(VISIBLE_FIELDS.length);
    }
  }, 30_000);

  it("damages every visible column of a settled save, not column 0 alone", async () => {
    // Glide's edit flash lasts 500 ms and hides the tail of a fast save. A
    // slower one leaves the grey pending tint on every column this call does
    // not name.
    const h = makeHarness(1_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(5)).toBeDefined(), { timeout: 10_000 });

    h.updateCells.mockClear();

    act(() => result.current.onCellEdited([0, 5], typedCell));

    await waitFor(() => expect(h.updateRow).toHaveBeenCalled());
    await waitFor(() => expect(h.damaged().length).toBeGreaterThan(0), { timeout: 10_000 });

    expect(h.columnsDamagedFor(5)).toEqual([0, 1]);
  }, 30_000);

  it("keeps an edit started on the held view, and lands it on the view that adopts", async () => {
    // The hold leaves the grid editable for the whole load, which the old
    // blank-and-reload design did not. Two things then have to hold. The
    // overlay is keyed by ROW KEY, so the typed value survives the change of
    // index space; and the settle path has to patch the store now on screen,
    // not the one `saveCell` started under. Miss either and the user watches
    // the edit vanish with no error.
    const h = makeHarness(1_000);

    let landSave: () => void = () => {};
    const saveGate = new Promise<void>((resolve) => {
      landSave = resolve;
    });

    h.updateRow.mockImplementation(async ({ id, changes }) => {
      await saveGate;

      return { ok: true, row: { id, name: String(changes.name), g: Math.floor(id / GROUP_SIZE) } };
    });

    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(5)).toBeDefined(), { timeout: 10_000 });

    const heldStore = result.current.store;

    act(() => result.current.onCellEdited([0, 5], typedCell));
    expect(cellText(result.current.getCellContent([0, 5]))).toBe("typed");

    // Sorting by group is stable over these rows and the comparator breaks ties
    // on the row key, so data index 5 still holds id 5 afterwards. The STORE is
    // replaced all the same, which is the whole point of the case.
    act(() => void h.store.dispatch(h.instance.actions.setSort({ field: "g", dir: "asc" })));

    await waitFor(() => expect(result.current.isStale).toBe(false), { timeout: 10_000 });
    expect(result.current.store).not.toBe(heldStore);

    // The overlay crossed the swap, so the typed value is still on screen while
    // the save is still in flight.
    expect(cellText(result.current.getCellContent([0, 5]))).toBe("typed");

    landSave();

    // The adopted store took the server's row. The discarded one is not what
    // the grid draws, so a patch that landed there would leave "row-5" here.
    await waitFor(() => expect(result.current.store.getRow(5)?.name).toBe("typed"), {
      timeout: 10_000,
    });

    expect(cellText(result.current.getCellContent([0, 5]))).toBe("typed");
    expect(h.lastError()).toBeNull();
  }, 30_000);

  it("still rolls an edit back on the adopted view when the save is rejected", async () => {
    // The mirror of the case above. Carrying the overlay across a swap must not
    // turn a rejected save into a value that stays on screen.
    const h = makeHarness(1_000);

    let landSave: () => void = () => {};
    const saveGate = new Promise<void>((resolve) => {
      landSave = resolve;
    });

    h.updateRow.mockImplementation(async () => {
      await saveGate;

      return { ok: false };
    });

    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(5)).toBeDefined(), { timeout: 10_000 });

    act(() => result.current.onCellEdited([0, 5], typedCell));

    act(() => void h.store.dispatch(h.instance.actions.setSort({ field: "g", dir: "asc" })));

    await waitFor(() => expect(result.current.isStale).toBe(false), { timeout: 10_000 });
    expect(cellText(result.current.getCellContent([0, 5]))).toBe("typed");

    landSave();

    await waitFor(() => expect(cellText(result.current.getCellContent([0, 5]))).toBe("row-5"), {
      timeout: 10_000,
    });

    expect(h.lastError()?.message).toBe("Failed to save name");
  }, 30_000);

  it("keeps rows on screen while a pushed create reloads the window", async () => {
    const h = makeHarness(1_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(0)).toBeDefined(), { timeout: 10_000 });
    expect(cellText(result.current.getCellContent([0, 5]))).toBe("row-5");

    act(() => {
      h.server.setRows([{ id: -1, name: "inserted", g: 0 }, ...h.server.rows]);
      h.server.push({ kind: "create", id: -1 });
    });

    // Sampled across the whole buffer and reload. A create shifts every
    // position, so the rows MUST be refetched — and they must never blank
    // while that happens.
    for (let i = 0; i < 20; i += 1) {
      expect(result.current.getCellContent([0, 5]).kind).toBe(GridCellKind.Text);
      await act(() => new Promise((r) => setTimeout(r, 15)));
    }

    await waitFor(() => expect(cellText(result.current.getCellContent([0, 0]))).toBe("inserted"), {
      timeout: 10_000,
    });
  }, 30_000);

  it("patches a pushed update in place, without reloading the window", async () => {
    const h = makeHarness(1_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(0)).toBeDefined(), { timeout: 10_000 });

    const before = h.requested().length;

    act(() => {
      h.server.setRows(h.server.rows.map((r) => (r.id === 5 ? { ...r, name: "pushed" } : r)));
      h.server.push({ kind: "update", id: 5 });
    });

    await waitFor(() => expect(cellText(result.current.getCellContent([0, 5]))).toBe("pushed"), {
      timeout: 10_000,
    });

    // An update moves no position, so it costs no page request.
    expect(h.requested()).toHaveLength(before);
  }, 30_000);

  it("repaints the display row of a pushed update, not only the store", async () => {
    // A pure update raises no generation bump and no query invalidation, so
    // nothing re-renders and nothing else damages. Reading the cell through
    // `getCellContent` proves the STORE; only the damage call proves the
    // SCREEN, and the row keeps its old value on screen without it.
    //
    // Grouped, so the store's index and the display row are different numbers
    // and a repaint that skipped the translation could not pass.
    const h = makeHarness(1_000, { grouped: true });
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(65)).toBeDefined(), { timeout: 10_000 });
    await waitFor(() => expect(hasHeaderFor(result.current.model, 1)).toBe(true), {
      timeout: 10_000,
    });

    // Group 0's header, its 60 rows, then group 1's header: data 65 draws at
    // display 67.
    expect(displayToData(result.current.model, 67)).toEqual({ kind: "data", dataIndex: 65 });

    h.updateCells.mockClear();

    act(() => {
      h.server.setRows(h.server.rows.map((r) => (r.id === 65 ? { ...r, name: "pushed" } : r)));
      h.server.push({ kind: "update", id: 65 });
    });

    await waitFor(() => expect(cellText(result.current.getCellContent([0, 67]))).toBe("pushed"), {
      timeout: 10_000,
    });

    // `store.indexOfKey` answers 65. The damage must be display row 67, and it
    // must cover the whole row.
    expect(new Set(h.damaged())).toEqual(new Set([67]));
    expect(h.columnsDamagedFor(67)).toEqual([0, 1]);
  }, 30_000);

  it("lands a pushed update on the view that adopts, when a create opened the hold", async () => {
    // A create opens a hold of the push feed's own making, and an update
    // arriving before that hold adopts used to be written to the displayed
    // store alone — the one store adoption throws away. Nothing heals it
    // afterwards: `useRowPages` fetches with no observer, so a page that
    // already reads "loaded" is never fetched again.
    const h = makeHarness(1_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    // The model needs its row count before a scroll can name any data row.
    await waitFor(() => expect(result.current.total).toBe(1_000), { timeout: 10_000 });

    // A three-page window, so the hold can be held half open below.
    act(() => result.current.onVisibleRegionChanged(scrollTo(150)));
    await waitFor(() => expect(result.current.rowAt(250)).toBeDefined(), { timeout: 10_000 });
    expect(cellText(result.current.getCellContent([0, 5]))).toBe("row-5");

    h.holdPage(0);
    h.holdPage(100);
    h.holdPage(200);

    // A create at the END moves no index this case reads, and it still sets
    // `reload`, so the hold opens without disturbing the arithmetic.
    act(() => {
      h.server.setRows([...h.server.rows, { id: 1_000, name: "appended", g: 16 }]);
      h.server.push({ kind: "create", id: 1_000 });
    });

    await flushPush();
    expect(result.current.isStale).toBe(true);

    // Page 0 of the PENDING store lands with the OLD value of row 5, and pages
    // 1 and 2 keep the hold open. That gap is where the defect lived.
    h.releasePage(0);
    await settleTick();
    expect(result.current.isStale).toBe(true);

    act(() => {
      h.server.setRows(h.server.rows.map((r) => (r.id === 5 ? { ...r, name: "pushed" } : r)));
      h.server.push({ kind: "update", id: 5 });
    });

    await flushPush();

    h.releasePage(100);
    h.releasePage(200);

    await waitFor(() => expect(result.current.isStale).toBe(false), { timeout: 10_000 });

    // The adopted view is the pending store. Patching the displayed store alone
    // leaves "row-5" here.
    expect(cellText(result.current.getCellContent([0, 5]))).toBe("pushed");
  }, 30_000);

  it("lands a pushed update the pending store alone has loaded, during a hold", async () => {
    // The window moves while the hold is open, so the pending store fetches a
    // page the displayed store never held. Asking the displayed store alone
    // answers "nobody has row 400" and the update is dropped with no fetch.
    const h = makeHarness(1_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(0)).toBeDefined(), { timeout: 10_000 });

    // Every page the hold will want, gated up front except page 4.
    h.holdPage(0);
    h.holdPage(500);
    h.holdPage(600);

    act(() => {
      h.server.setRows([...h.server.rows, { id: 1_000, name: "appended", g: 16 }]);
      h.server.push({ kind: "create", id: 1_000 });
    });

    await flushPush();
    expect(result.current.isStale).toBe(true);

    // The window moves to rows 400-699 while the hold is open, so only the
    // PENDING store ever asks for them.
    act(() => result.current.onVisibleRegionChanged(scrollTo(500)));
    await waitFor(() => expect(h.requested().some((r) => r.offset === 400)).toBe(true), {
      timeout: 10_000,
    });

    h.releasePage(0);
    await settleTick();
    expect(result.current.isStale).toBe(true);

    act(() => {
      h.server.setRows(h.server.rows.map((r) => (r.id === 400 ? { ...r, name: "pushed" } : r)));
      h.server.push({ kind: "update", id: 400 });
    });

    await flushPush();

    h.releasePage(500);
    h.releasePage(600);

    await waitFor(() => expect(result.current.isStale).toBe(false), { timeout: 10_000 });

    expect(cellText(result.current.getCellContent([0, 400]))).toBe("pushed");
  }, 30_000);

  it("applies a pushed update with no hold open, and opens no hold to do it", async () => {
    // The mirror of the two above. An update moves no position, so it must
    // never take the create's path: bumping the generation for one cell would
    // throw away every loaded page and refetch the whole window.
    const h = makeHarness(1_000);
    const { result } = renderHook(() => useComposedGrid(h.instance, h.gridRef), {
      wrapper: h.wrapper,
    });

    await waitFor(() => expect(result.current.rowAt(5)).toBeDefined(), { timeout: 10_000 });

    const before = h.requested().length;

    act(() => {
      h.server.setRows(h.server.rows.map((r) => (r.id === 5 ? { ...r, name: "pushed" } : r)));
      h.server.push({ kind: "update", id: 5 });
    });

    // Sampled across the whole buffer and the flush. No hold may open at any
    // point, and the rows must never blank.
    for (let i = 0; i < 20; i += 1) {
      expect(result.current.isStale).toBe(false);
      expect(result.current.getCellContent([0, 5]).kind).toBe(GridCellKind.Text);
      await act(() => new Promise((r) => setTimeout(r, 15)));
    }

    expect(cellText(result.current.getCellContent([0, 5]))).toBe("pushed");
    expect(h.requested()).toHaveLength(before);
  }, 30_000);
});
