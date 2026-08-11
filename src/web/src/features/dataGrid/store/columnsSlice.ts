import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ColumnsState } from "../types";

export function createColumnsSlice(
  name: string,
  opts: { defaultOrder: string[]; load?: () => Promise<ColumnsState | null> },
) {
  const { defaultOrder, load } = opts;
  const initialState: ColumnsState = { order: [...defaultOrder], widths: {}, hidden: [] };

  const slice = createSlice({
    name: `${name}/columns`,
    initialState,
    reducers: {
      moveColumn(state, action: PayloadAction<{ from: number; to: number }>) {
        const { from, to } = action.payload;
        if (from < 0 || from >= state.order.length) return;
        const [m] = state.order.splice(from, 1);
        state.order.splice(to, 0, m);
      },
      resizeColumn(state, action: PayloadAction<{ field: string; width: number }>) {
        state.widths[action.payload.field] = action.payload.width;
      },
      toggleColumn(state, action: PayloadAction<string>) {
        const f = action.payload;
        if (state.hidden.includes(f)) state.hidden = state.hidden.filter((x) => x !== f);
        else state.hidden.push(f);
      },
      // Hydration from a load. Merge: only overwrite a field when the loaded value
      // is meaningful, so a partial/empty stored payload can't blank the grid.
      setColumns(state, action: PayloadAction<ColumnsState>) {
        const next = action.payload;
        if (next.order?.length) state.order = next.order;
        if (next.widths) state.widths = next.widths;
        if (next.hidden) state.hidden = next.hidden;
      },
    },
  });

  // loadColumns thunk — hydrate from descriptor.api.loadColumns (if any) on mount.
  // Single-slice: only dispatches this slice's setColumns, so it lives with the slice.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadColumns = () => async (dispatch: any) => {
    if (!load) return;

    const loaded = await load();

    if (loaded) dispatch(slice.actions.setColumns(loaded));
  };

  return { reducer: slice.reducer, actions: slice.actions, loadColumns };
}
