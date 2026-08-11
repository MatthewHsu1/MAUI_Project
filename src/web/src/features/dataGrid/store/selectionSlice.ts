import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SelectionState } from "../types";

export function createSelectionSlice<TKey extends string | number>(name: string) {
  const initialState: SelectionState<TKey> = { selectedIds: [] };

  const slice = createSlice({
    name: `${name}/selection`,
    initialState,
    reducers: {
      setSelectedIds(state, action: PayloadAction<TKey[]>) {
        state.selectedIds = action.payload as typeof state.selectedIds;
      },
      clearSelection(state) {
        state.selectedIds = [];
      },
    },
  });

  return { reducer: slice.reducer, actions: slice.actions };
}
