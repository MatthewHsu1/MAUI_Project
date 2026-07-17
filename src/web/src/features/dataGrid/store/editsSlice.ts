import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { EditState, GridDescriptor, GridSliceState } from "../types";

export function createEditsSlice(name: string) {
  const initialState: EditState = { pending: {}, lastError: null };
  const slice = createSlice({
    name: `${name}/edits`,
    initialState,
    reducers: {
      editBegin(state, action: PayloadAction<{ key: string; prev: unknown }>) {
        state.pending[action.payload.key] = { prev: action.payload.prev };
        state.lastError = null;
      },
      editResolve(state, action: PayloadAction<string>) {
        delete state.pending[action.payload];
      },
      editFail(state, action: PayloadAction<{ key: string; message: string }>) {
        delete state.pending[action.payload.key];
        state.lastError = action.payload.message;
      },
    },
  });
  return { reducer: slice.reducer, actions: slice.actions };
}

interface SaveCellEditDeps<TRow, TGroup> {
  name: string;
  descriptor: GridDescriptor<TRow, TGroup>;
  pageSize: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gridDataActions: { applyEdit: (p: any) => any; invalidate: () => any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupsActions: { resetBoundaries: () => any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editsActions: {
    editBegin: (p: any) => any;
    editResolve: (p: any) => any;
    editFail: (p: any) => any;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchWindow: (arg: { skip: number; take: number }) => any;
}

/**
 * Optimistically apply a cell edit, persist via the descriptor's api, roll back
 * on failure. When the edited field is the grouping field and its group order
 * changes, the row moves groups → re-page from the top.
 */
export function createSaveCellEdit<TRow, TGroup>(deps: SaveCellEditDeps<TRow, TGroup>) {
  const { name, descriptor, pageSize, gridDataActions, groupsActions, editsActions, fetchWindow } =
    deps;

  return function saveCellEdit(args: { dataIndex: number; field: string; value: unknown }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (dispatch: any, getState: () => unknown) => {
      const { dataIndex, field, value } = args;
      const root = (getState() as Record<string, GridSliceState<TRow, TGroup>>)[name];
      const row = root.gridData.byIndex[dataIndex];
      if (!row) return;

      const key = `${descriptor.rowKey(row)}:${field}`;
      const prev = (row as unknown as Record<string, unknown>)[field];

      dispatch(gridDataActions.applyEdit({ dataIndex, field, value }));
      dispatch(editsActions.editBegin({ key, prev }));

      const res = await descriptor.api.updateRow({ id: descriptor.rowKey(row), field, value });

      if (res.ok) {
        dispatch(editsActions.editResolve(key));
        const grouping = descriptor.grouping;
        if (
          grouping &&
          fieldIsGroupKey(descriptor, field) &&
          grouping.order(prev as TGroup) !== grouping.order(value as TGroup)
        ) {
          dispatch(groupsActions.resetBoundaries());
          dispatch(gridDataActions.invalidate());
          dispatch(fetchWindow({ skip: 0, take: pageSize }));
        }
      } else {
        dispatch(gridDataActions.applyEdit({ dataIndex, field, value: prev }));
        dispatch(editsActions.editFail({ key, message: `Failed to save ${field}` }));
      }
    };
  };
}

function fieldIsGroupKey<TRow, TGroup>(
  descriptor: GridDescriptor<TRow, TGroup>,
  field: string,
): boolean {
  return descriptor.grouping?.field === field;
}
