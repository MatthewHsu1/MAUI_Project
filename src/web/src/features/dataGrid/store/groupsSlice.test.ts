import { describe, expect, it } from "vitest";
import { createGroupsSlice } from "./groupsSlice";

describe("createGroupsSlice", () => {
  it("starts empty", () => {
    const { reducer } = createGroupsSlice<number>("test");
    const s = reducer(undefined, { type: "@@init" });
    expect(s).toEqual({ discoveredGroups: [], collapsedGroups: [], sort: null });
  });

  it("accumulates discovered groups without duplicating them", () => {
    const { reducer, actions } = createGroupsSlice<number>("test");
    let s = reducer(undefined, actions.groupsDiscovered([0, 1]));
    s = reducer(s, actions.groupsDiscovered([1, 2]));
    expect(s.discoveredGroups).toEqual([0, 1, 2]);
  });

  it("remembers a collapsed group's key after its rows stop being served", () => {
    const { reducer, actions } = createGroupsSlice<number>("test");
    let s = reducer(undefined, actions.groupsDiscovered([0, 1]));
    s = reducer(s, actions.toggleCollapse(1));
    // A later window excludes group 1 entirely; the memory has to survive it,
    // or the header the user expands from would vanish.
    s = reducer(s, actions.groupsDiscovered([0]));
    expect(s.collapsedGroups).toEqual([1]);
    expect(s.discoveredGroups).toEqual([0, 1]);
  });

  it("toggleCollapse is symmetric", () => {
    const { reducer, actions } = createGroupsSlice<number>("test");
    let s = reducer(undefined, actions.toggleCollapse(3));
    expect(s.collapsedGroups).toEqual([3]);
    s = reducer(s, actions.toggleCollapse(3));
    expect(s.collapsedGroups).toEqual([]);
  });

  it("setSort records the sort and nothing else", () => {
    const { reducer, actions } = createGroupsSlice<number>("test");
    let s = reducer(undefined, actions.groupsDiscovered([0]));
    s = reducer(s, actions.setSort({ field: "id", dir: "asc" }));
    expect(s.sort).toEqual({ field: "id", dir: "asc" });
    // Boundaries are derived from the loaded windows now, so a sort change has
    // nothing to invalidate here.
    expect(s.discoveredGroups).toEqual([0]);
  });
});
