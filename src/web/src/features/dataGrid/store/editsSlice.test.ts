import { describe, expect, it } from "vitest";
import { createEditsSlice } from "./editsSlice";

/** Cell A and cell B: same field, different rows — the shape of two overlapping saves. */
const A = { cell: "1:name", message: "Failed to save name" };
const B = { cell: "2:name", message: "Failed to save name" };

describe("createEditsSlice", () => {
  it("starts with no error", () => {
    const { reducer } = createEditsSlice("test");
    expect(reducer(undefined, { type: "@@init" }).lastError).toBeNull();
  });

  it("editFail records the message and the cell it belongs to", () => {
    const { reducer, actions } = createEditsSlice("test");
    const s = reducer(undefined, actions.editFail(A));
    expect(s.lastError).toEqual(A);
  });

  it("a later failure replaces the earlier message", () => {
    const { reducer, actions } = createEditsSlice("test");
    let s = reducer(undefined, actions.editFail({ cell: "1:name", message: "first" }));
    s = reducer(s, actions.editFail({ cell: "1:name", message: "second" }));
    expect(s.lastError?.message).toBe("second");
  });

  it("a failure on another cell replaces the message too, because the banner shows one", () => {
    const { reducer, actions } = createEditsSlice("test");
    let s = reducer(undefined, actions.editFail(A));
    s = reducer(s, actions.editFail(B));
    expect(s.lastError).toEqual(B);
  });

  it("editSucceeded clears the error when the cell that succeeded is the cell that failed", () => {
    const { reducer, actions } = createEditsSlice("test");
    let s = reducer(undefined, actions.editFail(A));
    s = reducer(s, actions.editSucceeded(A.cell));
    expect(s.lastError).toBeNull();
  });

  it("editSucceeded leaves another cell's error standing, so a failure is never erased unseen", () => {
    const { reducer, actions } = createEditsSlice("test");
    let s = reducer(undefined, actions.editFail(A));
    s = reducer(s, actions.editSucceeded(B.cell));
    expect(s.lastError).toEqual(A);
  });

  it("editErrorCleared takes the message away whatever cell it came from", () => {
    const { reducer, actions } = createEditsSlice("test");
    let s = reducer(undefined, actions.editFail(A));
    s = reducer(s, actions.editErrorCleared());
    expect(s.lastError).toBeNull();
  });
});
