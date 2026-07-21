import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";
import { appListener, startAppListening } from "./listener";
import { rootReducer } from "./rootReducer";

describe("app listener", () => {
  it("lets any feature register an effect, without touching store wiring", () => {
    const store = configureStore({
      reducer: rootReducer,
      middleware: (getDefault) =>
        getDefault({ serializableCheck: false }).concat(appListener.middleware),
    });
    const seen = vi.fn();

    const stop = startAppListening({
      predicate: (action) => action.type === "demo/ping",
      effect: (_action, api) => {
        // getState is typed as RootState, not unknown.
        seen(api.getState().appearance.appearance);
      },
    });
    store.dispatch({ type: "demo/ping" });

    expect(seen).toHaveBeenCalledWith("light");

    stop();
  });

  it("stops delivering to a listener once its unsubscribe has run", () => {
    const store = configureStore({
      reducer: rootReducer,
      middleware: (getDefault) =>
        getDefault({ serializableCheck: false }).concat(appListener.middleware),
    });
    const seen = vi.fn();

    const stop = startAppListening({
      predicate: (action) => action.type === "demo/ping",
      effect: () => seen(),
    });
    stop();
    store.dispatch({ type: "demo/ping" });

    expect(seen).not.toHaveBeenCalled();
  });
});
