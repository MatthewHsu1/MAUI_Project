import { GridCellKind } from "@glideapps/glide-data-grid";
import { describe, expect, it } from "vitest";
import { createPhoneCell } from "./createPhoneCell";

const cell = createPhoneCell({ kind: "phone-test" });
const nullableCell = createPhoneCell({ kind: "phone-nullable-test", nullable: true });

describe("createPhoneCell", () => {
  it("makeCell builds a custom cell with kind, E.164 value, and E.164 copyData", () => {
    const c = cell.makeCell("+14155552671");
    expect(c.kind).toBe(GridCellKind.Custom);
    expect(c.data).toEqual({ kind: "phone-test", value: "+14155552671" });
    expect(c.copyData).toBe("+14155552671");
  });

  it("makeCell(null) builds a cleared cell with null value and empty copyData", () => {
    const c = cell.makeCell(null);
    expect(c.data).toEqual({ kind: "phone-test", value: null });
    expect(c.copyData).toBe("");
  });

  it("the renderer matches its own cell kind and not a foreign one", () => {
    expect(cell.renderer.isMatch(cell.makeCell("+14155552671"))).toBe(true);
    expect(cell.renderer.isMatch(nullableCell.makeCell("+14155552671"))).toBe(false);
  });

  it("validate blocks empty when not nullable, allows it when nullable", () => {
    expect(cell.validate(cell.makeCell(null))).toBe(false);
    expect(nullableCell.validate(nullableCell.makeCell(null))).toBe(true);
  });

  it("validate accepts a valid number and rejects a malformed one", () => {
    expect(cell.validate(cell.makeCell("+14155552671"))).toBe(true);
    expect(cell.validate(cell.makeCell("+1234"))).toBe(false);
  });

  it("onPaste parses a national string to E.164 and rejects junk", () => {
    const onPaste = cell.renderer.onPaste!;
    const data = cell.makeCell(null).data;
    expect(onPaste("(415) 555-2671", data)).toEqual({ kind: "phone-test", value: "+14155552671" });
    expect(onPaste("garbage", data)).toBeUndefined();
  });

  it("onPaste rejects an empty paste when not nullable but clears when nullable", () => {
    expect(cell.renderer.onPaste!("   ", cell.makeCell("+14155552671").data)).toBeUndefined();
    expect(
      nullableCell.renderer.onPaste!("   ", nullableCell.makeCell("+14155552671").data),
    ).toEqual({ kind: "phone-nullable-test", value: null });
  });
});

describe("createPhoneCell.makeCell allowOverlay", () => {
  it("disables the overlay when allowOverlay is false", () => {
    expect(cell.makeCell("+14155552671", false).allowOverlay).toBe(false);
  });

  it("allows the overlay by default", () => {
    expect(cell.makeCell("+14155552671").allowOverlay).toBe(true);
  });

  it("flags the cell read-only (draws — for empty) when the overlay is disabled", () => {
    expect(cell.makeCell(null, false).data.readOnly).toBe(true);
  });

  it("leaves an editable cell unflagged so an empty value stays blank", () => {
    expect(cell.makeCell("+14155552671").data.readOnly).toBeUndefined();
  });
});

function fakeCtx() {
  const calls: string[] = [];
  const ctx = {
    font: "",
    fillStyle: "" as string,
    textBaseline: "alphabetic" as CanvasTextBaseline,
    fillText: (t: string) => {
      calls.push(t);
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const theme = {
  textDark: "#111",
  textLight: "#999",
  baseFontFull: "13px sans-serif",
  cellHorizontalPadding: 8,
};
const rect = { x: 0, y: 0, width: 120, height: 34 };
const drawArgs = (ctx: CanvasRenderingContext2D) =>
  ({ ctx, rect, theme }) as unknown as Parameters<typeof cell.renderer.draw>[0];

describe("createPhoneCell draw", () => {
  it("draws an em dash for a read-only empty cell", () => {
    const { ctx, calls } = fakeCtx();
    cell.renderer.draw(drawArgs(ctx), cell.makeCell(null, false));
    expect(calls).toEqual(["—"]);
  });

  it("draws nothing for an editable empty cell", () => {
    const { ctx, calls } = fakeCtx();
    cell.renderer.draw(drawArgs(ctx), cell.makeCell(null));
    expect(calls).toEqual([]);
  });
});
