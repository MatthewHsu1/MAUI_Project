import { createListenerMiddleware } from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "./rootReducer";

/**
 * The single listener middleware for the whole app.
 *
 * One shared instance rather than one per feature: listeners already
 * discriminate by action type or predicate, so a per-feature middleware buys
 * nothing and forces the store to `.concat` a new entry for every feature
 * added. Anything that needs action-driven side-effects — grids included —
 * registers here.
 */
export const appListener = createListenerMiddleware();

/**
 * Register an effect. Pre-typed with app state and dispatch, so effects get a
 * typed `getState()`/`dispatch()` without restating the generics. Returns an
 * unsubscribe.
 */
export const startAppListening = appListener.startListening.withTypes<RootState, AppDispatch>();
