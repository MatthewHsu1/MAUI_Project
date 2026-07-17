import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SelectionState } from "../types";

export function createSelectionSlice(name: string) {
  const initialState: SelectionState = { selectedIds: [] };
  const slice = createSlice({
    name: `${name}/selection`,
    initialState,
    reducers: {
      setSelectedIds(state, action: PayloadAction<number[]>) {
        state.selectedIds = action.payload;
      },
      clearSelection(state) {
        state.selectedIds = [];
      },
    },
  });
  return { reducer: slice.reducer, actions: slice.actions };
}
