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
});
