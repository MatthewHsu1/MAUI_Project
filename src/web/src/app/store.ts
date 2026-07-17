import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import appearance from "../theme/appearanceSlice";

// Today the store carries only the appearance signal. Adding a grid means editing
// this file by hand: build an instance with createGridInstance, then add its
// reducer to the map below and .concat() its middleware. There is no
// auto-registration.
//
// serializableCheck is off because grid state is not serializable — row windows
// hold arbitrary TRow objects and group keys are caller-defined. Nothing in the
// current store needs the exemption (an appearance string is plainly
// serializable); it is set here so the first grid to register does not have to
// rediscover why RTK is warning at it.
export const store = configureStore({
  reducer: { appearance },
  middleware: (getDefault) => getDefault({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
