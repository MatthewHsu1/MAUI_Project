import type { Reducer } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";
import { injectSlice, onSliceInjected, rootReducer } from "./rootReducer";

// injectSlice only accepts reducerPaths declared in LazyLoadedSlices, which real
// grids augment. These tests exercise the mechanism with a stub, so they cast.
const injectStub = injectSlice as unknown as (slice: {
  reducerPath: string;
  reducer: Reducer<unknown>;
}) => void;

// Order matters: the first test asserts the pre-injection shape, so it must run
// before the others inject anything.
describe("rootReducer", () => {
  it("starts with only the eagerly combined slices", () => {
    const state = rootReducer(undefined, { type: "@@init" });
    expect(Object.keys(state)).toEqual(["appearance"]);
  });

  it("serves an injected reducer under its reducerPath, alongside the eager ones", () => {
    injectStub({ reducerPath: "demo", reducer: () => ({ hit: true }) });

    const state = rootReducer(undefined, { type: "@@init" }) as Record<string, unknown>;

    expect(state.demo).toEqual({ hit: true });
    expect(state.appearance).toBeDefined();
  });

  it("notifies the registered listener so an already-built store can refresh", () => {
    const notify = vi.fn();
    onSliceInjected(notify);

    injectStub({ reducerPath: "demo2", reducer: () => ({ hit: true }) });

    expect(notify).toHaveBeenCalledOnce();
  });
});
