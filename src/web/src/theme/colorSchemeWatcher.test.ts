import { afterEach, describe, expect, it, vi } from "vitest";
import { appearanceFromMatches, startColorSchemeWatcher } from "./colorSchemeWatcher";

describe("appearanceFromMatches", () => {
  it("maps a dark match to dark", () => {
    expect(appearanceFromMatches(true)).toBe("dark");
  });

  it("maps no match to light", () => {
    expect(appearanceFromMatches(false)).toBe("light");
  });
});

// --- matchMedia stub (jsdom does not implement matchMedia) ---
// The stub honours listener identity: removeEventListener drops the exact
// callback it was given, and emitChange() invokes only the still-attached ones.
// That is what lets stop() be tested behaviourally (a change after stop must not
// dispatch), rather than by trusting a "removeEventListener was called" flag —
// which would pass even if stop() detached the wrong function.
type Listener = () => void;

function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initialMatches,
    addEventListener: (event: string, cb: Listener) => {
      if (event === "change") listeners.add(cb);
    },
    removeEventListener: (event: string, cb: Listener) => {
      if (event === "change") listeners.delete(cb);
    },
    /** Fire a change to every currently-attached listener (test helper). */
    emitChange: () => listeners.forEach((cb) => cb()),
    /** How many listeners are currently attached (test helper). */
    listenerCount: () => listeners.size,
  };
  globalThis.matchMedia = vi.fn(() => mql) as unknown as typeof matchMedia;
  return mql;
}

afterEach(() => {
  globalThis.matchMedia = undefined as unknown as typeof matchMedia;
  vi.restoreAllMocks();
});

describe("startColorSchemeWatcher", () => {
  it("dispatches the initial appearance from the current colour scheme", () => {
    stubMatchMedia(true);
    const dispatch = vi.fn();

    startColorSchemeWatcher(dispatch);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].payload).toBe("dark");
  });

  it("dispatches the new appearance when the colour scheme changes", () => {
    const mql = stubMatchMedia(false);
    const dispatch = vi.fn();

    startColorSchemeWatcher(dispatch);
    expect(dispatch.mock.calls[0][0].payload).toBe("light");

    mql.matches = true;
    mql.emitChange();

    expect(dispatch.mock.calls[1][0].payload).toBe("dark");
  });

  it("stop() detaches the listener so later changes no longer dispatch", () => {
    const mql = stubMatchMedia(false);
    const dispatch = vi.fn();

    const stop = startColorSchemeWatcher(dispatch);
    expect(mql.listenerCount()).toBe(1);
    dispatch.mockClear();

    stop();
    expect(mql.listenerCount()).toBe(0);

    // A change after stop() must not reach the (now-detached) listener.
    mql.matches = true;
    mql.emitChange();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("defaults to light and is a no-op stop when matchMedia is absent", () => {
    globalThis.matchMedia = undefined as unknown as typeof matchMedia;
    const dispatch = vi.fn();

    const stop = startColorSchemeWatcher(dispatch);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].payload).toBe("light");
    expect(() => stop()).not.toThrow();
  });
});
