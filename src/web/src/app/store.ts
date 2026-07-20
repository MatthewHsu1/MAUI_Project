import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
// Deep import, not the barrel: features/bonds/index re-exports BondsPage, which
// pulls DataGrid -> useGridTheme -> app/store, i.e. a cycle back into this file.
import { bondGrid, GRID_NAME } from "../features/bonds/bondGrid";
import appearance from "../theme/appearanceSlice";

// GridDescriptor.name is typed as a plain `string` (it's generic across every
// future grid), but mixing a `string`-typed computed key with a literal key
// (`appearance`) in one object literal makes TS synthesize a single merged
// index signature for the reducer map, which then fails configureStore's
// structural check (each slice reducer only accepts its own state, so it
// can't satisfy an index signature typed to accept either slice's state). The
// `as typeof GRID_NAME` below only pins the *type* to the literal the grid is
// actually named; the key is still read from `bondGrid.descriptor.name` at
// runtime.
const BONDS_KEY = bondGrid.descriptor.name as typeof GRID_NAME;

// serializableCheck is off because grid state is not serializable — row windows
// hold arbitrary TRow objects and group keys are caller-defined.
export const store = configureStore({
  reducer: {
    appearance,
    [BONDS_KEY]: bondGrid.reducer,
  },
  middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(bondGrid.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
