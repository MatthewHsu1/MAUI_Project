import {
  combineSlices,
  type Reducer,
  type ThunkDispatch,
  type UnknownAction,
} from "@reduxjs/toolkit";
import { appearanceReducer as appearance } from "@matthewhsu1/datagrid";

/**
 * Slices that register themselves at import time rather than being listed here.
 *
 * A grid module augments this interface with its own key (see bondGrid.ts) and
 * calls `rootReducer.inject(...)`, so adding a grid never touches app/. The
 * state type therefore comes from declaration merging instead of from
 * inferring an object literal — which is what lets the key stay a literal
 * without casting a `string`-typed descriptor name.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LazyLoadedSlices {}

/**
 * The store's reducer. `appearance` is eager (app-wide, always present);
 * everything else is injected by the feature that owns it, so its state only
 * exists once that feature's module has loaded.
 */
export const rootReducer = combineSlices({ appearance }).withLazyLoadedSlices<LazyLoadedSlices>();

/**
 * Derived from the reducer rather than from `store.getState`, so modules the
 * store itself depends on (app/listener) can be typed against app state without
 * a circular reference back through configureStore.
 */
export type RootState = ReturnType<typeof rootReducer>;

/** Matches the dispatch configureStore produces with the default thunk middleware. */
export type AppDispatch = ThunkDispatch<RootState, undefined, UnknownAction>;

let notifyInjected: (() => void) | null = null;

/**
 * Registered by app/store so injections landing after the store was created can
 * refresh its state. Lives here rather than in store.ts because rootReducer
 * cannot import the store (the store imports this module).
 */
export function onSliceInjected(notify: () => void): void {
  notifyInjected = notify;
}

/**
 * Add a slice to the store's reducer. Use this rather than `rootReducer.inject`
 * directly: bare `inject` only updates the reducer map, so a slice injected
 * after the store was built has no state until the next dispatch — which is too
 * late for a component that reads it on its first render.
 */
export function injectSlice<Path extends keyof LazyLoadedSlices & string>(slice: {
  reducerPath: Path;
  reducer: Reducer<LazyLoadedSlices[Path]>;
}): void {
  // The declaration-merged Path/state pairing above is the real check; RTK's
  // inject overloads don't accept it generically, hence the cast.
  rootReducer.inject(slice as Parameters<typeof rootReducer.inject>[0]);
  notifyInjected?.();
}
