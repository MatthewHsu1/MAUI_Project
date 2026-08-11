// src/features/dataGrid/hooks/useDisplayModel.test.tsx
import { configureStore } from "@reduxjs/toolkit";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { createGridInstance } from "../store/createGridInstance";
import type { GridDescriptor } from "../types";
import type { LoadedSpan } from "../data/spanFromStore";
import { useDisplayModel } from "./useDisplayModel";

interface Row {
  id: number;
  g: number;
}

/** Six rows, two groups: ids 0-2 in group 0, ids 3-5 in group 1. */
const ALL: Row[] = Array.from({ length: 6 }, (_, i) => ({ id: i, g: Math.floor(i / 3) }));
const TOTAL = ALL.length;

const spanOf = (rows: Row[]): LoadedSpan<Row, number> => ({
  rows,
  offset: 0,
  precedingGroupKey: null,
});

/** A span the grid loaded after scrolling: it starts below row 0. */
const windowAt = (
  rows: Row[],
  offset: number,
  preceding: number | null,
): LoadedSpan<Row, number> => ({
  rows,
  offset,
  precedingGroupKey: preceding,
});

function makeHarness() {
  const descriptor = {
    name: "demo",
    rowKey: (r: Row) => r.id,
    grouping: { field: "g", of: (r: Row) => r.g, order: (g: number) => g, label: String },
    columns: {
      defs: { id: { field: "id", title: "Id", defaultWidth: 80, editable: false, type: "number" } },
      defaultOrder: ["id"],
    },
    api: {
      fetchRows: async () => [],
      fetchCount: async () => TOTAL,
      fetchRow: async () => null,
      updateRow: async () => ({ ok: true }),
    },
    cells: { makeCell: () => ({}) as never, customRenderers: [], validateCell: () => true },
  } as unknown as GridDescriptor<Row, number>;

  const instance = createGridInstance(descriptor);
  const store = configureStore({
    reducer: { demo: instance.reducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return { instance, store, wrapper };
}

const groupsOf = (instance: ReturnType<typeof makeHarness>["instance"], state: unknown) =>
  instance.selectRoot(state).groups;

describe("useDisplayModel", () => {
  it("records the groups a loaded span carries", () => {
    const { instance, store, wrapper } = makeHarness();

    renderHook(() => useDisplayModel(instance, { total: TOTAL, span: spanOf(ALL) }), { wrapper });

    expect(groupsOf(instance, store.getState()).discoveredGroups).toEqual([0, 1]);
  });

  it("keeps a collapsed group expandable after its rows leave the span", () => {
    // The regression this guards: the server excludes a collapsed group's rows,
    // so if nothing remembered the group, its header — the only way back — would
    // vanish from the model and the collapse would be one-way.
    const { instance, store, wrapper } = makeHarness();

    const remaining = ALL.filter((r) => r.g === 0);

    const { result, rerender } = renderHook(
      ({ span, total }) => useDisplayModel(instance, { total, span }),
      { wrapper, initialProps: { span: spanOf(ALL), total: TOTAL } },
    );

    act(() => void store.dispatch(instance.actions.toggleCollapse(1)));

    // The next load comes back without group 1's rows, exactly as the server
    // sends it once the group is collapsed.
    rerender({ span: spanOf(remaining), total: remaining.length });

    const collapsedSegment = result.current.model.segments.find((s) => s.group === 1);
    expect(collapsedSegment).toBeDefined();
    expect(collapsedSegment?.hasHeader).toBe(true);
    expect(collapsedSegment?.collapsed).toBe(true);

    // And the header is clickable back into an expanded group.
    act(() => result.current.onHeaderOrCellClicked([0, collapsedSegment!.displayStart]));

    expect(groupsOf(instance, store.getState()).collapsedGroups).not.toContain(1);
  });

  it("keeps its rows when the window scrolls into the middle of one group", () => {
    // The regression this guards: a window inside one group holds no group
    // change, so `detectBoundaries` reports nothing. The model then made no
    // segment for those rows, `rowCount` fell to 0, and the grid emptied itself
    // — scroll bar included. It could not recover, because a grid that draws no
    // rows commits no viewport range and so never asks for more rows.
    const { instance, wrapper } = makeHarness();

    const { result, rerender } = renderHook(
      ({ span }) => useDisplayModel(instance, { total: TOTAL, span }),
      { wrapper, initialProps: { span: spanOf(ALL) } },
    );

    // The window moves to rows 4-5, which sit wholly inside group 1.
    rerender({ span: windowAt(ALL.slice(4), 4, 1) });

    expect(result.current.model.rowCount).toBeGreaterThanOrEqual(TOTAL);
  });

  it("measures where the collapse starts before it dispatches", () => {
    // `useGridData` reads this cell on the render the collapse lands in, and it
    // keeps every page that ends above the index in it. Nobody else can measure
    // it: only this hook holds the display model.
    const { instance, wrapper } = makeHarness();

    const { result } = renderHook(
      () => useDisplayModel(instance, { total: TOTAL, span: spanOf(ALL) }),
      { wrapper },
    );

    const header = result.current.model.segments.find((s) => s.group === 1);

    act(() => result.current.onHeaderOrCellClicked([0, header!.displayStart]));

    // Group 1 opens at data row 3. Rows 0 to 2 keep their index either way.
    expect(instance.carryFromRef.current).toBe(3);
  });

  it("leaves the boundary alone when the click lands on a data row", () => {
    const { instance, wrapper } = makeHarness();

    const { result } = renderHook(
      () => useDisplayModel(instance, { total: TOTAL, span: spanOf(ALL) }),
      { wrapper },
    );

    act(() => result.current.onHeaderOrCellClicked([0, 1]));

    expect(instance.carryFromRef.current).toBeNull();
  });

  it("keeps its rows while a moved window is still loading", () => {
    // An empty span carries neither a boundary nor a preceding group. The rows
    // must stay drawn anyway, or the same deadlock closes before the rows land.
    const { instance, wrapper } = makeHarness();

    const { result, rerender } = renderHook(
      ({ span }) => useDisplayModel(instance, { total: TOTAL, span }),
      { wrapper, initialProps: { span: spanOf(ALL) } },
    );

    rerender({ span: windowAt([], 4, null) });

    expect(result.current.model.rowCount).toBe(TOTAL);
  });
});
