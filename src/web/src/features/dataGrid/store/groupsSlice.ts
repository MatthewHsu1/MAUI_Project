import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { detectBoundaries, type Boundary } from "../displayModel";
import type { GridDescriptor, GroupsState } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FetchWindowThunk = { fulfilled: { type: string; match: (a: any) => boolean } };

export function createGroupsSlice<TRow, TGroup>(
  name: string,
  descriptor: GridDescriptor<TRow, TGroup>,
  fetchWindow: FetchWindowThunk,
) {
  const initialState: GroupsState<TGroup> = {
    boundaries: [],
    discoveredGroups: [],
    collapsedGroups: [],
    sort: null,
  };

  function mergeBoundary(list: Boundary<TGroup>[], b: Boundary<TGroup>) {
    const existing = list.find((x) => x.dataIndex === b.dataIndex);
    if (existing) existing.group = b.group;
    else list.push(b);
  }

  const slice = createSlice({
    name: `${name}/groups`,
    initialState,
    reducers: {
      toggleCollapse(state, action: PayloadAction<TGroup>) {
        const g = action.payload;
        if ((state.collapsedGroups as TGroup[]).includes(g)) {
          state.collapsedGroups = state.collapsedGroups.filter((x) => x !== g) as never;
        } else {
          (state.collapsedGroups as TGroup[]).push(g);
        }
      },
      setSort(state, action: PayloadAction<GroupsState<TGroup>["sort"]>) {
        state.sort = action.payload;
        state.boundaries = [];
      },
      resetBoundaries(state) {
        state.boundaries = [];
      },
    },
    extraReducers: (b) => {
      const grouping = descriptor.grouping;
      if (!grouping) return;
      b.addCase(
        fetchWindow.fulfilled as never,
        (
          state,
          action: PayloadAction<{ skip: number; rows: TRow[]; precedingGroupKey: TGroup | null }>,
        ) => {
          const { skip, rows, precedingGroupKey } = action.payload;
          const found = detectBoundaries(rows, precedingGroupKey, skip, grouping.of);
          found.forEach((bd) => mergeBoundary(state.boundaries as Boundary<TGroup>[], bd));
          for (const r of rows) {
            const g = grouping.of(r);
            if (!(state.discoveredGroups as TGroup[]).includes(g))
              (state.discoveredGroups as TGroup[]).push(g);
          }
        },
      );
    },
  });

  return { reducer: slice.reducer, actions: slice.actions };
}
