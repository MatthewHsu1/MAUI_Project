// src/features/dataGrid/hooks/useGridColumns.test.tsx
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { SORT_ASC_ICON, SORT_DESC_ICON } from "../headerIcons";
import { createGridInstance } from "../store/createGridInstance";
import type { GridDescriptor } from "../types";
import { useGridColumns } from "./useGridColumns";

interface Row {
  id: number;
  name: string;
}

const FIELDS = ["id", "name"];

function makeHarness() {
  const descriptor = {
    name: "demo",
    rowKey: (r: Row) => r.id,
    columns: {
      defs: {
        id: { field: "id", title: "Id", defaultWidth: 80, editable: false, type: "number" },
        name: { field: "name", title: "Name", defaultWidth: 120, editable: false, type: "text" },
      },
      defaultOrder: FIELDS,
      sortable: () => true,
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

  return { instance, store, wrapper };
}

const render = (h: ReturnType<typeof makeHarness>) =>
  renderHook(() => useGridColumns(h.instance), { wrapper: h.wrapper });

const indicators = (columns: { indicatorIcon?: string }[]) => columns.map((c) => c.indicatorIcon);

describe("useGridColumns sort indicator", () => {
  it("shows no indicator on any column while the grid is unsorted", async () => {
    const h = makeHarness();
    const { result } = render(h);

    await waitFor(() => expect(result.current.columns).toHaveLength(2));
    expect(indicators(result.current.columns)).toEqual([undefined, undefined]);
  });

  it("marks the sorted column ascending, and only that column", async () => {
    const h = makeHarness();
    const { result } = render(h);
    await waitFor(() => expect(result.current.columns).toHaveLength(2));

    act(() => void h.store.dispatch(h.instance.actions.setSort({ field: "name", dir: "asc" })));

    expect(indicators(result.current.columns)).toEqual([undefined, SORT_ASC_ICON]);
  });

  it("flips the chevron when the direction reverses", async () => {
    const h = makeHarness();
    const { result } = render(h);
    await waitFor(() => expect(result.current.columns).toHaveLength(2));

    act(() => void h.store.dispatch(h.instance.actions.setSort({ field: "id", dir: "desc" })));

    expect(indicators(result.current.columns)).toEqual([SORT_DESC_ICON, undefined]);
  });

  it("drops the indicator when the sort is cleared", async () => {
    const h = makeHarness();
    const { result } = render(h);
    await waitFor(() => expect(result.current.columns).toHaveLength(2));

    act(() => void h.store.dispatch(h.instance.actions.setSort({ field: "id", dir: "asc" })));
    act(() => void h.store.dispatch(h.instance.actions.setSort(null)));

    expect(indicators(result.current.columns)).toEqual([undefined, undefined]);
  });

  it("still reports width and title alongside the indicator", async () => {
    const h = makeHarness();
    const { result } = render(h);
    await waitFor(() => expect(result.current.columns).toHaveLength(2));

    act(() => void h.store.dispatch(h.instance.actions.setSort({ field: "name", dir: "asc" })));

    expect(result.current.columns[1]).toMatchObject({
      id: "name",
      title: "Name",
      width: 120,
      indicatorIcon: SORT_ASC_ICON,
    });
  });
});
