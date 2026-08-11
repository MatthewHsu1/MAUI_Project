import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFlatModel, type DisplayModel } from "../displayModel";
import { rangeForViewport, useWindowRange, WINDOW_COMMIT_WAIT_MS } from "./useWindowRange";

const flat = (total: number) => buildFlatModel(total) as DisplayModel<never>;

describe("rangeForViewport", () => {
  it("rounds the start down to a page and pads one page each side", () => {
    expect(rangeForViewport(flat(1000), 250, 260, 100)).toEqual({ offset: 100, limit: 300 });
  });

  it("never returns a negative offset", () => {
    expect(rangeForViewport(flat(1000), 0, 10, 100)).toEqual({ offset: 0, limit: 200 });
  });

  it("returns null when the range holds no data rows", () => {
    expect(rangeForViewport(flat(0), 0, 10, 100)).toBeNull();
  });
});

describe("useWindowRange", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts on the first page", () => {
    const { result } = renderHook(() => useWindowRange(100));
    expect(result.current.range).toEqual({ offset: 0, limit: 100 });
  });

  it("commits one range after scrolling settles", () => {
    const model = flat(1000);
    const { result } = renderHook(() => useWindowRange(100));

    act(() => {
      result.current.onRectChanged(model, { x: 0, y: 100, width: 5, height: 10 });
      result.current.onRectChanged(model, { x: 0, y: 300, width: 5, height: 10 });
      result.current.onRectChanged(model, { x: 0, y: 500, width: 5, height: 10 });
    });

    expect(result.current.range).toEqual({ offset: 0, limit: 100 });

    act(() => void vi.advanceTimersByTime(WINDOW_COMMIT_WAIT_MS + 1));

    expect(result.current.range).toEqual({ offset: 400, limit: 300 });
  });

  it("commits while a steady scroll never rests for the full wait", () => {
    const model = flat(100_000);
    const { result } = renderHook(() => useWindowRange(100));

    // A drag that reports a new rect more often than the debouncer can fire.
    // The range recomputes to the same value on most of these, and passing
    // those repeats to the debouncer restarted its timer for ever.
    act(() => {
      for (let i = 1; i <= 40; i += 1) {
        result.current.onRectChanged(model, { x: 0, y: i * 5, width: 5, height: 10 });
        vi.advanceTimersByTime(WINDOW_COMMIT_WAIT_MS - 20);
      }
    });

    expect(result.current.range).not.toEqual({ offset: 0, limit: 100 });
  });

  it("commits a window the store already holds without any wait", () => {
    const model = flat(1000);
    const loaded = { current: () => true };

    const { result } = renderHook(() => useWindowRange(100, loaded));

    act(() => {
      result.current.onRectChanged(model, { x: 0, y: 500, width: 5, height: 10 });
    });

    // No timer advanced. Cached rows draw on the frame the scroll reaches them.
    expect(result.current.range).toEqual({ offset: 400, limit: 300 });
  });

  it("still waits out the scroll for a window that would fetch", () => {
    const model = flat(1000);
    const loaded = { current: () => false };

    const { result } = renderHook(() => useWindowRange(100, loaded));

    act(() => {
      result.current.onRectChanged(model, { x: 0, y: 500, width: 5, height: 10 });
    });

    expect(result.current.range).toEqual({ offset: 0, limit: 100 });

    act(() => void vi.advanceTimersByTime(WINDOW_COMMIT_WAIT_MS + 1));

    expect(result.current.range).toEqual({ offset: 400, limit: 300 });
  });

  it("drops a pending cold window when the scroll lands back on cached rows", () => {
    const model = flat(10_000);
    const loaded = { current: (r: { offset: number }) => r.offset < 1000 };

    const { result } = renderHook(() => useWindowRange(100, loaded));

    // A flick into cold data arms the wait, then the user comes straight back.
    act(() => {
      result.current.onRectChanged(model, { x: 0, y: 5000, width: 5, height: 10 });
      result.current.onRectChanged(model, { x: 0, y: 300, width: 5, height: 10 });
    });

    expect(result.current.range).toEqual({ offset: 200, limit: 300 });

    // The armed window must never land on top of the one the user is reading.
    act(() => void vi.advanceTimersByTime(WINDOW_COMMIT_WAIT_MS + 1));

    expect(result.current.range).toEqual({ offset: 200, limit: 300 });
  });

  it("keeps the previous range when the viewport describes no data rows", () => {
    const model = flat(1000);
    const { result } = renderHook(() => useWindowRange(100));

    act(() => {
      result.current.onRectChanged(model, { x: 0, y: 500, width: 5, height: 10 });
      vi.advanceTimersByTime(WINDOW_COMMIT_WAIT_MS + 1);
    });

    expect(result.current.range).toEqual({ offset: 400, limit: 300 });

    act(() => {
      result.current.onRectChanged(flat(0), { x: 0, y: 0, width: 5, height: 3 });
      vi.advanceTimersByTime(WINDOW_COMMIT_WAIT_MS + 1);
    });

    expect(result.current.range).toEqual({ offset: 400, limit: 300 });
  });
});
