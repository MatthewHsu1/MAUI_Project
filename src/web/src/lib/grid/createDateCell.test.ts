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

  it("flags the cell read-only (draws — for empty) when the overlay is disabled", () => {
    expect(date.makeCell(null, false, false).data.readOnly).toBe(true);
  });

  it("leaves an editable cell unflagged so an empty value stays blank", () => {
    expect(date.makeCell(null, false).data.readOnly).toBeUndefined();
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
  ({ ctx, rect, theme }) as unknown as Parameters<typeof date.renderer.draw>[0];

describe("createDateCell draw", () => {
  it("draws an em dash for a read-only empty cell", () => {
    const { ctx, calls } = fakeCtx();
    date.renderer.draw(drawArgs(ctx), date.makeCell(null, false, false));
    expect(calls).toEqual(["—"]);
  });

  it("draws nothing for an editable empty cell", () => {
    const { ctx, calls } = fakeCtx();
    date.renderer.draw(drawArgs(ctx), date.makeCell(null, false));
    expect(calls).toEqual([]);
  });

  it("draws the localized date for a non-empty cell", () => {
    const { ctx, calls } = fakeCtx();
    date.renderer.draw(drawArgs(ctx), date.makeCell("2026-06-20T00:00:00Z", false, false));
    expect(calls).toEqual(["6/20/2026"]);
  });
});
