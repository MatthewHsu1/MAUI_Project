import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { GridDataState, GridDescriptor, GridSliceState } from "../types";

export function createGridDataSlice<TRow, TGroup>(
  name: string,
  descriptor: GridDescriptor<TRow, TGroup>,
) {
  const initialState: GridDataState<TRow> = { byIndex: {}, loadingWindows: {}, total: 0 };

  interface FulfilledPayload {
    skip: number;
    rows: TRow[];
    total: number;
    precedingGroupKey: TGroup | null;
  }

  const fetchWindow = createAsyncThunk(
    `${name}/gridData/fetchWindow`,
    async ({ skip, take }: { skip: number; take: number }, { getState }) => {
      const root = (getState() as Record<string, GridSliceState<TRow, TGroup>>)[name];
      const res = await descriptor.api.fetchWindow({
        skip,
        take,
        collapsedGroups: root.groups.collapsedGroups,
        sort: root.groups.sort ?? undefined,
      });
      return {
        skip,
        rows: res.rows,
        total: res.total,
        precedingGroupKey: res.precedingGroupKey,
      } as FulfilledPayload;
    },
  );

  const slice = createSlice({
    name: `${name}/gridData`,
    initialState,
    reducers: {
      applyEdit(
        state,
        action: PayloadAction<{ dataIndex: number; field: string; value: unknown }>,
      ) {
        const r = state.byIndex[action.payload.dataIndex];
        if (r) (r as Record<string, unknown>)[action.payload.field] = action.payload.value;
      },
      invalidate(state) {
        state.byIndex = {};
        state.loadingWindows = {};
      },
    },
    extraReducers: (b) => {
      b.addCase(fetchWindow.pending, (state, action) => {
        state.loadingWindows[action.meta.arg.skip] = true;
      });
      b.addCase(fetchWindow.fulfilled, (state, action) => {
        const { skip, rows, total } = action.payload;
        state.total = total;
        rows.forEach((r, i) => {
          (state.byIndex as Record<number, TRow>)[skip + i] = r;
        });
        delete state.loadingWindows[skip];
      });
      b.addCase(fetchWindow.rejected, (state, action) => {
        delete state.loadingWindows[action.meta.arg.skip];
      });
    },
  });

  return { reducer: slice.reducer, actions: slice.actions, fetchWindow };
}
