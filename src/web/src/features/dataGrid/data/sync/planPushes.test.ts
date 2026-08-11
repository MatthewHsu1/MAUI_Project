import { describe, expect, it } from "vitest";
import type { RowChange } from "../../types";
import { planPushes } from "./planPushes";

const change = (
  kind: RowChange<number>["kind"],
  id: number,
  sequence: number,
): RowChange<number> => ({ kind, id, sequence });

const loaded =
  (...ids: number[]) =>
  (key: number) =>
    ids.includes(key);

describe("planPushes", () => {
  it("refetches an update for a row that is loaded", () => {
    const plan = planPushes([change("update", 1, 1)], loaded(1), 0);
    expect(plan).toEqual({ refetchIds: [1], deleteIds: [], reload: false, recount: false });
  });

  it("ignores an update for a row that is not loaded", () => {
    const plan = planPushes([change("update", 9, 1)], loaded(1), 0);
    expect(plan.refetchIds).toEqual([]);
    expect(plan.reload).toBe(false);
  });

  it("reloads and recounts on a create, because positions shift", () => {
    const plan = planPushes([change("create", 5, 1)], loaded(1), 0);
    expect(plan.reload).toBe(true);
    expect(plan.recount).toBe(true);
  });

  it("deletes and recounts on a delete", () => {
    const plan = planPushes([change("delete", 1, 1)], loaded(1), 0);
    expect(plan.deleteIds).toEqual([1]);
    expect(plan.recount).toBe(true);
    expect(plan.reload).toBe(false);
  });

  it("deletes a row it never loaded without complaint", () => {
    const plan = planPushes([change("delete", 9, 1)], loaded(1), 0);
    expect(plan.deleteIds).toEqual([9]);
  });

  it("keeps only the last change for one id", () => {
    const plan = planPushes(
      [change("update", 1, 1), change("update", 1, 2), change("delete", 1, 3)],
      loaded(1),
      0,
    );
    expect(plan.refetchIds).toEqual([]);
    expect(plan.deleteIds).toEqual([1]);
  });

  it("reloads everything when the sequence has a gap", () => {
    const plan = planPushes([change("update", 1, 7)], loaded(1), 3);
    expect(plan.reload).toBe(true);
    expect(plan.recount).toBe(true);
  });

  it("does not treat the first message as a gap", () => {
    const plan = planPushes([change("update", 1, 7)], loaded(1), null);
    expect(plan.reload).toBe(false);
    expect(plan.refetchIds).toEqual([1]);
  });

  it("returns an empty plan for no messages", () => {
    expect(planPushes([], loaded(1), 0)).toEqual({
      refetchIds: [],
      deleteIds: [],
      reload: false,
      recount: false,
    });
  });

  it("reloads everything when the sequence has a gap inside the buffer", () => {
    const plan = planPushes([change("update", 1, 1), change("update", 2, 3)], loaded(1, 2), 0);
    expect(plan.reload).toBe(true);
    expect(plan.recount).toBe(true);
    expect(plan.refetchIds).toEqual([]);
  });

  it("handles out-of-order arrival with contiguous sequences", () => {
    const plan = planPushes(
      [change("update", 1, 3), change("update", 2, 1), change("update", 3, 2)],
      loaded(1, 2, 3),
      0,
    );
    expect(plan.reload).toBe(false);
    expect(plan.recount).toBe(false);
    expect(plan.refetchIds.sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("keeps the last change when delete comes before update", () => {
    const plan = planPushes([change("delete", 1, 1), change("update", 1, 2)], loaded(1), 0);
    expect(plan.refetchIds).toEqual([1]);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.recount).toBe(false);
    expect(plan.reload).toBe(false);
  });
});
