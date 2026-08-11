import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { EditError, EditState } from "../types";

/**
 * `lastError` is the banner over the grid, so it needs a way in AND two ways
 * out — and the two ways out are not the same, which is why they are two
 * actions and not one.
 *
 * - `editFail` is the way in: `useCellRenderer` dispatches it when the
 *   collection's transaction rejects. It names the cell as well as the message.
 *
 * - `editSucceeded` is the CONDITIONAL way out, dispatched when a save
 *   persists. It clears the banner only when the cell that succeeded is the
 *   cell that failed. An unconditional clear here would let a success on one
 *   cell erase another cell's failure — two overlapping saves with mixed
 *   outcomes are enough — and the user would never learn the failed save did
 *   not land. Note that a save that succeeds while no error is showing is a
 *   no-op, which is what it should be.
 *
 * - `editErrorCleared` is the UNCONDITIONAL way out, dispatched by
 *   `GridStatusBar`'s dismiss. Dismiss means "I am done with this message",
 *   whatever cell it came from, so it carries no cell and matches nothing.
 *   Clearing on success alone would leave a user who gives up editing staring
 *   at the message for the life of the page; a dismiss is the only exit that
 *   does not require another edit.
 *
 * `editBegin` / `editResolve` used to track an in-flight edit per cell so the
 * renderer could grey it. `data/editOverlay.ts` holds the optimistic value and
 * `useCellRenderer` reads its `isPending` instead — always in step with the
 * save, and with no key to keep aligned — so the `pending` map and both actions
 * are gone rather than left without a dispatcher. The `cell` on `lastError` is
 * NOT that map coming back: it is one string on the one error the banner is
 * already showing, not a record of every edit in flight.
 */
export function createEditsSlice(name: string) {
  const initialState: EditState = { lastError: null };
  const slice = createSlice({
    name: `${name}/edits`,
    initialState,
    reducers: {
      editFail(state, action: PayloadAction<EditError>) {
        state.lastError = action.payload;
      },
      editSucceeded(state, action: PayloadAction<string>) {
        if (state.lastError?.cell === action.payload) state.lastError = null;
      },
      editErrorCleared(state) {
        state.lastError = null;
      },
    },
  });
  return { reducer: slice.reducer, actions: slice.actions };
}
