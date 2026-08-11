import { GridCellKind, type EditableGridCell } from "@glideapps/glide-data-grid";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Provider, useSelector } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { buildFlatModel } from "./displayModel";
import { GridStatusBar } from "./GridStatusBar";
import { useCellRenderer } from "./hooks/useCellRenderer";
import { useGridData } from "./hooks/useGridData";
import { createGridInstance } from "./store/createGridInstance";
import { createFakeRowServer } from "./testing/fakeRowServer";
import type { GridDescriptor, GridInstance } from "./types";
import { useGridDispatch } from "./useGridDispatch";

interface Row {
  id: number;
}

const WINDOW = { offset: 0, limit: 100 };

const noRepaint = () => {};

/**
 * Renders exactly what `DataGrid` renders above the grid body: `GridStatusBar`
 * wired to `useGridData`'s `status`/`retry` and `edits.lastError` off the store.
 * A real `DataEditor` mount needs jsdom polyfills this project doesn't carry
 * (ResizeObserver, canvas), so this proves the same wiring without it.
 */
function StatusBarUnderTest({ instance }: { instance: GridInstance<Row, number, number> }) {
  const { status, total, retry } = useGridData(instance, WINDOW, null, [], noRepaint);
  const lastError = useSelector((s: unknown) => instance.selectRoot(s).edits.lastError);

  return (
    <GridStatusBar
      status={status}
      error={lastError?.message ?? null}
      rowCount={total}
      onRetry={retry}
    />
  );
}

function makeHarness(fetchRows: ReturnType<typeof vi.fn>) {
  const descriptor = {
    name: "demo",
    rowKey: (r: Row) => r.id,
    pageSize: 100,
    columns: { defs: {}, defaultOrder: [] },
    api: {
      fetchRows,
      fetchCount: async () => 0,
      fetchRow: async () => null,
      updateRow: async () => ({ ok: false }),
      subscribe: () => () => {},
    },
    cells: { makeCell: () => ({}) as never, customRenderers: [], validateCell: () => true },
  } as unknown as GridDescriptor<Row, number, number>;

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

  return { instance, wrapper };
}

describe("DataGrid status wiring", () => {
  it("shows the alert and a retry when the initial row load fails, instead of rendering as empty", async () => {
    const server = createFakeRowServer<Row, number, number>({
      rows: [{ id: 1 }],
      rowKey: (r) => r.id,
    });
    const fetchRows = vi.fn().mockRejectedValue(new Error("boom"));
    const { instance, wrapper } = makeHarness(fetchRows);

    const { container } = render(<StatusBarUnderTest instance={instance} />, { wrapper });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not load/i));
    // A failed load is no longer indistinguishable from an empty, settled grid.
    expect(container).not.toBeEmptyDOMElement();

    fetchRows.mockImplementation((p: Parameters<typeof server.api.fetchRows>[0]) =>
      server.api.fetchRows(p),
    );
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});

/**
 * The edit banner end to end: a real row store and edit overlay whose
 * `updateRow` decides the outcome, `useCellRenderer` turning that outcome into
 * `edits.lastError`, and `GridStatusBar` turning that into the banner the user
 * actually sees.
 *
 * It asserts on the banner rather than on `lastError`, because "the banner
 * goes" is the claim; a cleared field that still painted would satisfy the
 * weaker assertion.
 */
function EditBannerUnderTest({ instance }: { instance: GridInstance<EditRow, number, number> }) {
  const dispatch = useGridDispatch();

  const { rowAt, isPending, total, status, overlay, store } = useGridData(
    instance,
    WINDOW,
    null,
    [],
    noRepaint,
  );

  const lastError = useSelector((s: unknown) => instance.selectRoot(s).edits.lastError);

  const { onCellEdited } = useCellRenderer(instance, {
    model: buildFlatModel(total),
    visibleFields: ["name"],
    columnCount: 1,
    rowAt,
    isPending,
    overlay,
    store,
    repaint: noRepaint,
  });

  return (
    <>
      <GridStatusBar
        status={status}
        error={lastError?.message ?? null}
        rowCount={total}
        onRetry={() => {}}
        onDismissError={() => dispatch(instance.actions.editErrorCleared())}
      />
      <button type="button" onClick={() => onCellEdited([0, 0], typedCell)}>
        save A
      </button>
      <button type="button" onClick={() => onCellEdited([0, 1], typedCell)}>
        save B
      </button>
    </>
  );
}

interface EditRow {
  id: number;
  name: string;
}

const typedCell: EditableGridCell = {
  kind: GridCellKind.Text,
  data: "typed",
  displayData: "typed",
  allowOverlay: true,
};

function makeEditHarness() {
  // Two rows, so a save on one can be answered while the other's failure is
  // still on screen. Display row 0 is A (id 1), display row 1 is B (id 2).
  const rows: EditRow[] = [
    { id: 1, name: "a" },
    { id: 2, name: "b" },
  ];

  // Keyed by row id, so a test can fail one row's save and accept the other's.
  const outcomes = new Map<number, boolean>([
    [1, false],
    [2, false],
  ]);

  // An accepted save really writes, so a test can wait on the persisted value
  // rather than on a timer.
  const updateRow = vi.fn(async ({ id, changes }: { id: number; changes: Partial<EditRow> }) => {
    if (outcomes.get(id) !== true) {
      return { ok: false };
    }

    const i = rows.findIndex((r) => r.id === id);
    rows[i] = { ...rows[i], ...changes };

    return { ok: true, row: rows[i] };
  });

  const descriptor = {
    name: "demo",
    rowKey: (r: EditRow) => r.id,
    pageSize: 100,
    columns: {
      defs: {
        name: { field: "name", title: "Name", defaultWidth: 80, editable: true, type: "text" },
      },
      defaultOrder: ["name"],
    },
    api: {
      fetchRows: async () => rows,
      fetchCount: async () => rows.length,
      fetchRow: async () => null,
      updateRow,
    },
    cells: {
      makeCell: () => ({}) as never,
      customRenderers: [],
      validateCell: () => true,
    },
  } as unknown as GridDescriptor<EditRow, number, number>;

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

  const accept = (id: number) => outcomes.set(id, true);

  return { instance, accept, wrapper };
}

/** Both rows must reach the store, or an edit reads a row that is not there yet
 *  and a test would prove the wrong failure path. */
const bothRowsLoaded = (instance: GridInstance<EditRow, number, number>) =>
  waitFor(() => {
    expect(instance.storeRef.current?.indexOfKey(1)).toBe(0);
    expect(instance.storeRef.current?.indexOfKey(2)).toBe(1);
  });

describe("DataGrid edit-error wiring", () => {
  it("takes the banner down once the SAME cell saves successfully", async () => {
    const { instance, accept, wrapper } = makeEditHarness();
    render(<EditBannerUnderTest instance={instance} />, { wrapper });
    await bothRowsLoaded(instance);

    await userEvent.click(screen.getByRole("button", { name: /save A/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/failed to save name/i),
    );

    accept(1);
    await userEvent.click(screen.getByRole("button", { name: /save A/i }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("keeps the banner when a DIFFERENT cell saves successfully", async () => {
    const { instance, accept, wrapper } = makeEditHarness();
    render(<EditBannerUnderTest instance={instance} />, { wrapper });
    await bothRowsLoaded(instance);

    await userEvent.click(screen.getByRole("button", { name: /save A/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/failed to save name/i),
    );

    // B lands. That says nothing about A, whose save did not — and the user has
    // been told nothing else about A. An unconditional clear here would take
    // the only notice of A's failure off the screen.
    accept(2);
    await userEvent.click(screen.getByRole("button", { name: /save B/i }));
    await waitFor(() => expect(instance.storeRef.current?.getRow(1)?.name).toBe("typed"));

    expect(screen.getByRole("alert")).toHaveTextContent(/failed to save name/i);
  });

  it("lets a user dismiss the banner without editing again", async () => {
    const { instance, wrapper } = makeEditHarness();
    render(<EditBannerUnderTest instance={instance} />, { wrapper });
    await bothRowsLoaded(instance);

    await userEvent.click(screen.getByRole("button", { name: /save A/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    // Dismiss is unconditional on purpose: clearing on success alone strands a
    // user who stops editing, and "I am done with this message" holds whatever
    // cell it came from.
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
