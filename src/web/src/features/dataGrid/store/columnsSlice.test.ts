import { describe, expect, it } from "vitest";
import { createColumnsSlice } from "./columnsSlice";
import type { ColumnsState } from "../types";

const make = () => createColumnsSlice("test", { defaultOrder: ["a", "b", "c"] });

describe("createColumnsSlice", () => {
  it("toggleColumn hides then shows a field", () => {
    const { reducer, actions } = make();
    let s = reducer(undefined, { type: "@@init" });
    s = reducer(s, actions.toggleColumn("b"));
    expect(s.hidden).toContain("b");
    s = reducer(s, actions.toggleColumn("b"));
    expect(s.hidden).not.toContain("b");
  });

  it("moveColumn ignores an out-of-range source index", () => {
    const { reducer, actions } = make();
    const s0 = reducer(undefined, { type: "@@init" });
    const s1 = reducer(s0, actions.moveColumn({ from: 99, to: 0 }));
    expect(s1.order).toEqual(s0.order);
  });

  it("resizeColumn records a width", () => {
    const { reducer, actions } = make();
    const s = reducer(
      reducer(undefined, { type: "@@init" }),
      actions.resizeColumn({ field: "a", width: 321 }),
    );
    expect(s.widths.a).toBe(321);
  });

  describe("setColumns", () => {
    it("hydrates order/widths/hidden", () => {
      const { reducer, actions } = make();
      let s = reducer(undefined, { type: "@@init" });
      s = reducer(
        s,
        actions.setColumns({ order: ["c", "b", "a"], widths: { b: 50 }, hidden: ["a"] }),
      );
      expect(s.order).toEqual(["c", "b", "a"]);
      expect(s.widths.b).toBe(50);
      expect(s.hidden).toEqual(["a"]);
    });

    it("empty order: [] does NOT blank a populated default order (merge semantics)", () => {
      const { reducer, actions } = make();
      let s = reducer(undefined, { type: "@@init" });
      expect(s.order).toEqual(["a", "b", "c"]);
      s = reducer(s, actions.setColumns({ order: [], widths: { a: 10 }, hidden: [] }));
      expect(s.order).toEqual(["a", "b", "c"]);
    });
  });

  describe("loadColumns thunk", () => {
    const drain = async (
      thunk: ReturnType<ReturnType<typeof createColumnsSlice>["loadColumns"]>,
    ) => {
      const dispatched: unknown[] = [];
      await thunk((a: unknown) => dispatched.push(a));
      return dispatched;
    };

    it("dispatches setColumns with the loaded layout", async () => {
      const loaded: ColumnsState = { order: ["c", "a", "b"], widths: { a: 12 }, hidden: ["b"] };
      const { loadColumns } = createColumnsSlice("test", {
        defaultOrder: ["a", "b", "c"],
        load: async () => loaded,
      });
      const dispatched = await drain(loadColumns());
      expect(dispatched).toEqual([
        expect.objectContaining({ type: "test/columns/setColumns", payload: loaded }),
      ]);
    });

    it("no-ops when no load hook is provided", async () => {
      const { loadColumns } = make();
      expect(await drain(loadColumns())).toEqual([]);
    });

    it("no-ops when load resolves to null", async () => {
      const { loadColumns } = createColumnsSlice("test", {
        defaultOrder: ["a"],
        load: async () => null,
      });
      expect(await drain(loadColumns())).toEqual([]);
    });
  });
});
