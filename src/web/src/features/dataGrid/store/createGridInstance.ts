// src/features/dataGrid/store/createGridInstance.ts
import { combineReducers } from "@reduxjs/toolkit";
import type { RowStore } from "../data/rowStore";
import type { GridDescriptor, GridInstance, GridSliceState } from "../types";
import { createColumnsSlice } from "./columnsSlice";
import { registerEffects } from "./effects";
import type { GridEffectContext } from "./effects/types";
import { createEditsSlice } from "./editsSlice";
import { createGroupsSlice } from "./groupsSlice";
import { createSelectionSlice } from "./selectionSlice";

/**
 * Builds one grid's runtime. The reducer holds only client-owned state —
 * columns, selection, grouping, and the last edit error.
 *
 * No row is here and no row is in Redux. Server truth lives in the row store
 * (data/rowStore.ts), which a mounted grid creates through `hooks/useGridData.ts`,
 * and an edit that has not landed lives in the edit overlay
 * (data/editOverlay.ts) until the server answers.
 *
 * The instance carries that store through a stable ref cell, `storeRef`, rather
 * than through a value. The store belongs to whichever grid is mounted, while
 * the instance is created once at module scope, so the cell is what lets a
 * long-lived subscriber (data/sync/useRowSync.ts) reach the current store
 * without re-subscribing.
 */
export function createGridInstance<
  TRow extends object,
  TGroup,
  TKey extends string | number = number,
>(descriptor: GridDescriptor<TRow, TGroup, TKey>): GridInstance<TRow, TGroup, TKey> {
  const name = descriptor.name;

  // Published by `useGridData` when a grid mounts. It stays null until then,
  // and a push that arrives first is dropped rather than written to a store no
  // component is reading.
  const storeRef: { current: RowStore<TRow, TKey> | null } = { current: null };

  // The second store of a hold, published by the same hook. A push has to keep
  // BOTH current: `storeRef` is what the user reads now, and this one is what
  // adoption puts on screen next.
  const pendingStoreRef: { current: RowStore<TRow, TKey> | null } = { current: null };

  // Written by the header click, which is the only place that knows where a
  // group's rows start, and read once by `useGridData` on the render the
  // collapse change lands in. Null means "everything moves".
  const carryFromRef: { current: number | null } = { current: null };

  const groups = createGroupsSlice<TGroup>(name);

  const columns = createColumnsSlice(name, {
    defaultOrder: descriptor.columns.defaultOrder,
    load: descriptor.api.loadColumns,
  });

  const selection = createSelectionSlice<TKey>(name);

  const edits = createEditsSlice(name);

  const reducer = combineReducers({
    groups: groups.reducer,
    columns: columns.reducer,
    selection: selection.reducer,
    edits: edits.reducer,
  });

  const selectRoot = (s: unknown) => (s as Record<string, GridSliceState<TGroup, TKey>>)[name];

  // Register every GridEffect for this instance on the shared grid listener.
  const ctx: GridEffectContext<TRow, TGroup, TKey> = {
    name,
    descriptor,
    selectRoot,
    actions: {
      columns: columns.actions,
      groups: groups.actions,
      selection: selection.actions,
      edits: edits.actions,
    },
  };

  const stopEffects = registerEffects(ctx);

  // A push that moves positions cannot patch a page-indexed cache in place, so
  // it invalidates every loaded page instead. Bumping a number rather than
  // clearing the store is what lets `useGridData` load the replacement behind
  // the rows already on screen.
  //
  // This counter names WHICH SET OF ROWS the grid is showing, exactly as the
  // sort and the collapse set do, so a change of it builds a new store rather
  // than emptying the current one. No store is ever emptied in place.
  let dataGeneration = 0;
  const generationListeners = new Set<() => void>();

  const bumpDataGeneration = () => {
    dataGeneration += 1;

    for (const listener of generationListeners) {
      listener();
    }
  };

  const subscribeDataGeneration = (listener: () => void) => {
    generationListeners.add(listener);

    return () => {
      generationListeners.delete(listener);
    };
  };

  const getDataGeneration = () => dataGeneration;

  return {
    descriptor,
    reducer,
    selectRoot,
    actions: {
      ...groups.actions,
      ...columns.actions,
      ...selection.actions,
      ...edits.actions,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    storeRef,
    pendingStoreRef,
    carryFromRef,
    subscribeDataGeneration,
    getDataGeneration,
    bumpDataGeneration,
    stopEffects,
    thunks: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadColumns: columns.loadColumns as any,
    },
  };
}
