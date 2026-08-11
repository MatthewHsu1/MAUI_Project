import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { GroupsState } from "../types";

/**
 * Client-owned grouping state: what the user has collapsed, how they sorted,
 * and which groups they have encountered.
 *
 * It holds no rows and no boundaries. Boundaries are derived from the loaded
 * windows in `useDisplayModel`; nothing here has to be reset when rows change.
 */
export function createGroupsSlice<TGroup>(name: string) {
  const initialState: GroupsState<TGroup> = {
    discoveredGroups: [],
    collapsedGroups: [],
    sort: null,
  };

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
      },
      /**
       * Record groups seen in a loaded window. Monotonic on purpose: a group the
       * user collapses is excluded from every later window by the server, so
       * without this memory its header — and the only way to expand it again —
       * would disappear.
       */
      groupsDiscovered(state, action: PayloadAction<TGroup[]>) {
        for (const g of action.payload) {
          if (!(state.discoveredGroups as TGroup[]).includes(g)) {
            (state.discoveredGroups as TGroup[]).push(g);
          }
        }
      },
    },
  });

  return { reducer: slice.reducer, actions: slice.actions };
}
