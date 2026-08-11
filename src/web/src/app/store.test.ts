// Import order is the point of this test: store.ts no longer imports any grid,
// so the store is created BEFORE bondGrid injects its reducer. A grid's state
// must still be readable on the very first render, without waiting for a
// dispatch to rebuild the combined state.
import { describe, expect, it } from "vitest";
import { store } from "./store";
import { bondGrid } from "../features/bonds/bondGrid";

describe("store", () => {
  it("exposes a grid's state even though the grid injected itself after store creation", () => {
    expect(bondGrid.selectRoot(store.getState())).toBeDefined();
    expect(bondGrid.selectRoot(store.getState()).columns.order).toEqual(
      bondGrid.descriptor.columns.defaultOrder,
    );
  });
});
