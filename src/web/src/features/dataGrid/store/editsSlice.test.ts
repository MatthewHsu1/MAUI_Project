import { describe, expect, it } from "vitest";
import { createEditsSlice } from "./editsSlice";

describe("createEditsSlice", () => {
  it("editBegin records prev, editResolve clears it", () => {
    const { reducer, actions } = createEditsSlice("test");
    let s = reducer(undefined, actions.editBegin({ key: "1:name", prev: "old" }));
    expect(s.pending["1:name"]).toEqual({ prev: "old" });
    s = reducer(s, actions.editResolve("1:name"));
    expect(s.pending["1:name"]).toBeUndefined();
  });

  it("editFail clears pending and records the message", () => {
    const { reducer, actions } = createEditsSlice("test");
    let s = reducer(undefined, actions.editBegin({ key: "k", prev: 1 }));
    s = reducer(s, actions.editFail({ key: "k", message: "boom" }));
    expect(s.pending.k).toBeUndefined();
    expect(s.lastError).toBe("boom");
  });
});
