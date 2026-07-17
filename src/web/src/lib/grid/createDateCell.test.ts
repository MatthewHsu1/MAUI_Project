import { describe, expect, it } from "vitest";
import type { CustomCell } from "@glideapps/glide-data-grid";
import { createDateCell, type DateCellData } from "./createDateCell";

const date = createDateCell({ kind: "date", nullable: true });

describe("createDateCell.makeCell", () => {
  it("stores the ISO value, withTime flag, and ISO copyData", () => {
    const cell = date.makeCell("2026-06-20T00:00:00Z", true);
    expect(cell.data.kind).toBe("date");
    expect(cell.data.value).toBe("2026-06-20T00:00:00Z");
    expect(cell.data.withTime).toBe(true);
    expect(cell.copyData).toBe("2026-06-20T00:00:00Z");
  });

  it("renders a null value as empty copyData", () => {
    const cell = date.makeCell(null, false);
    expect(cell.data.value).toBeNull();
    expect(cell.data.withTime).toBe(false);
    expect(cell.copyData).toBe("");
  });

  it("disables the overlay when allowOverlay is false", () => {
    const cell = date.makeCell("2026-06-20T00:00:00Z", false, false);
    expect(cell.allowOverlay).toBe(false);
  });

  it("allows the overlay by default", () => {
    const cell = date.makeCell("2026-06-20T00:00:00Z", false);
    expect(cell.allowOverlay).toBe(true);
  });
});

describe("createDateCell.validate", () => {
  const mk = (value: string | null): CustomCell<DateCellData> => date.makeCell(value, false);

  it("accepts a valid ISO value", () => {
    expect(date.validate(mk("2026-06-20T00:00:00Z"))).toBe(true);
  });

  it("accepts empty because the cell is nullable", () => {
    expect(date.validate(mk(null))).toBe(true);
  });

  it("rejects a malformed non-empty value", () => {
    expect(date.validate(mk("garbage"))).toBe(false);
  });
});

describe("createDateCell.renderer", () => {
  it("matches cells of its kind", () => {
    const cell = date.makeCell("2026-06-20T00:00:00Z", false);
    expect(date.renderer.isMatch(cell)).toBe(true);
  });
});

describe("createDateCell.onPaste", () => {
  const baseData: DateCellData = { kind: "date", value: null, withTime: false };

  it("pins a pasted ISO date to UTC midnight for a date-only cell", () => {
    expect(date.renderer.onPaste?.("2026-06-20", baseData)).toEqual({
      kind: "date",
      value: "2026-06-20T00:00:00.000Z",
      withTime: false,
    });
  });

  it("rejects an unparseable paste (returns undefined)", () => {
    expect(date.renderer.onPaste?.("garbage", baseData)).toBeUndefined();
  });

  it("accepts an empty paste as null because the cell is nullable", () => {
    expect(date.renderer.onPaste?.("   ", baseData)).toEqual({
      kind: "date",
      value: null,
      withTime: false,
    });
  });

  it("preserves the time component when the cell is withTime", () => {
    expect(
      date.renderer.onPaste?.("2026-06-20T14:30:00Z", { ...baseData, withTime: true }),
    ).toEqual({
      kind: "date",
      value: "2026-06-20T14:30:00.000Z",
      withTime: true,
    });
  });
});
