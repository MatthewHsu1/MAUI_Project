// src/features/dataGrid/store/createGridInstance.ts
import { combineReducers } from "@reduxjs/toolkit";
import type { GridDescriptor, GridInstance, GridSliceState } from "../types";
import { createColumnsSlice } from "./columnsSlice";
import { registerEffects } from "./effects";
import type { GridEffectContext } from "./effects/types";
import { createEditsSlice, createSaveCellEdit } from "./editsSlice";
import { createGridDataSlice } from "./gridDataSlice";
import { createGroupsSlice } from "./groupsSlice";
import { createSelectionSlice } from "./selectionSlice";

export function createGridInstance<TRow, TGroup>(
  descriptor: GridDescriptor<TRow, TGroup>,
): GridInstance<TRow, TGroup> {
  const name = descriptor.name;

  const pageSize = descriptor.pageSize ?? 100;

  const gridData = createGridDataSlice<TRow, TGroup>(name, descriptor);

  const groups = createGroupsSlice<TRow, TGroup>(name, descriptor, gridData.fetchWindow);

  const columns = createColumnsSlice(name, {
    defaultOrder: descriptor.columns.defaultOrder,
    load: descriptor.api.loadColumns,
  });

  const selection = createSelectionSlice(name);

  const edits = createEditsSlice(name);

  const saveCellEdit = createSaveCellEdit<TRow, TGroup>({
    name,
    descriptor,
    pageSize,
    gridDataActions: gridData.actions,
    groupsActions: groups.actions,
    editsActions: edits.actions,
    fetchWindow: gridData.fetchWindow,
  });

  const reducer = combineReducers({
    gridData: gridData.reducer,
    groups: groups.reducer,
    columns: columns.reducer,
    selection: selection.reducer,
    edits: edits.reducer,
  });

  const selectRoot = (s: unknown) => (s as Record<string, GridSliceState<TRow, TGroup>>)[name];

  // Register every GridEffect for this instance on the shared grid listener.
  const ctx: GridEffectContext<TRow, TGroup> = {
    name,
    descriptor,
    selectRoot,
    actions: {
      columns: columns.actions,
      gridData: gridData.actions,
      groups: groups.actions,
      selection: selection.actions,
      edits: edits.actions,
    },
  };

  const stopEffects = registerEffects(ctx);

  return {
    descriptor,
    reducer,
    selectRoot,
    actions: {
      ...gridData.actions,
      ...groups.actions,
      ...columns.actions,
      ...selection.actions,
      ...edits.actions,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    stopEffects,
    thunks: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchWindow: gridData.fetchWindow as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      saveCellEdit: saveCellEdit as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadColumns: columns.loadColumns as any,
    },
  };
}
