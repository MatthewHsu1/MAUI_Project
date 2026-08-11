// src/features/dataGrid/hooks/useGridSort.test.tsx
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { createGridInstance } from "../store/createGridInstance";
import type { GridDescriptor } from "../types";
import { useGridSort } from "./useGridSort";

interface Row {
  id: number;
  name: string;
}

const FIELDS = ["id", "name", "notes"];

function makeHarness() {
  const descriptor = {
    name: "demo",
    rowKey: (r: Row) => r.id,
    columns: {
      defs: {
        id: { field: "id", title: "Id", defaultWidth: 80, editable: false, type: "number" },
        name: { field: "name", title: "Name", defaultWidth: 80, editable: false, type: "text" },
        notes: { field: "notes", title: "Notes", defaultWidth: 80, editable: false, type: "text" },
      },
      defaultOrder: FIELDS,
      // `notes` is the unsortable one, so a click on it must change nothing.
      sortable: (field: string) => field !== "notes",
    },
    api: {
      updateRow: async () => ({ ok: true }),
    },
    cells: { makeCell: () => ({}) as never, customRenderers: [], validateCell: () => true },
  } as unknown as GridDescriptor<Row, never, number>;

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

  const sortState = () => instance.selectRoot(store.getState()).groups.sort;

  return { instance, store, wrapper, sortState };
}

const render = (h: ReturnType<typeof makeHarness>) =>
  renderHook(() => useGridSort(h.instance, FIELDS), { wrapper: h.wrapper });

describe("useGridSort", () => {
  it("sorts ascending on the first click", () => {
    const h = makeHarness();
    const { result } = render(h);

    act(() => result.current.onHeaderClicked(0));

    expect(h.sortState()).toEqual({ field: "id", dir: "asc" });
  });

  it("reverses to descending when the same column is clicked again", () => {
    const h = makeHarness();
    const { result } = render(h);

    act(() => result.current.onHeaderClicked(0));
    act(() => result.current.onHeaderClicked(0));

    expect(h.sortState()).toEqual({ field: "id", dir: "desc" });
  });

  it("clears the sort on the third click, so natural order is reachable", () => {
    const h = makeHarness();
    const { result } = render(h);

    act(() => result.current.onHeaderClicked(0));
    act(() => result.current.onHeaderClicked(0));
    act(() => result.current.onHeaderClicked(0));

    expect(h.sortState()).toBeNull();
  });

  it("cycles from the start again after clearing", () => {
    const h = makeHarness();
    const { result } = render(h);

    for (let i = 0; i < 4; i++) act(() => result.current.onHeaderClicked(0));

    expect(h.sortState()).toEqual({ field: "id", dir: "asc" });
  });

  it("starts a different column ascending rather than inheriting the direction", () => {
    const h = makeHarness();
    const { result } = render(h);

    act(() => result.current.onHeaderClicked(0));
    act(() => result.current.onHeaderClicked(0));
    expect(h.sortState()).toEqual({ field: "id", dir: "desc" });

    act(() => result.current.onHeaderClicked(1));

    expect(h.sortState()).toEqual({ field: "name", dir: "asc" });
  });

  it("ignores clicks on a column that is not sortable", () => {
    const h = makeHarness();
    const { result } = render(h);

    act(() => result.current.onHeaderClicked(0));
    act(() => result.current.onHeaderClicked(2));

    expect(h.sortState()).toEqual({ field: "id", dir: "asc" });
  });
});
