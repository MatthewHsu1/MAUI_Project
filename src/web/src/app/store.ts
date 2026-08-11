import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import { appListener } from "./listener";
import { onSliceInjected, rootReducer, type AppDispatch, type RootState } from "./rootReducer";

// Nothing feature-specific is wired here: a feature injects its own reducer into
// rootReducer and registers its own effects on appListener when its module
// loads, so adding a feature never touches this file.
//
// serializableCheck is off because grid state is not serializable — row windows
// hold arbitrary TRow objects and group keys are caller-defined.
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) =>
    getDefault({ serializableCheck: false }).concat(appListener.middleware),
});

// A feature module may be imported after this file has run. Rebuild the store's
// state when that happens, so the feature's slice is present on first render
// rather than only after the next dispatch.
onSliceInjected(() => store.replaceReducer(rootReducer));

export type { AppDispatch, RootState };
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
