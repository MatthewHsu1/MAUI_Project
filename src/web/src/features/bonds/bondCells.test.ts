import { GridCellKind, type CustomCell } from "@glideapps/glide-data-grid";
import { describe, expect, it } from "vitest";
import { bondCells } from "./bondCells";

const ctx = { editable: false, withTime: false };
const cell = (type: string, raw: unknown) =>
  bondCells.makeCell(type, raw, ctx) as CustomCell<Record<string, unknown>>;
const data = (type: string, raw: unknown) => cell(type, raw).data;

describe("bondCells", () => {
  it("carries the numeric value for the currency and shares columns", () => {
    expect(data("ntCurrency2", 128.5).value).toBe(128.5);
    expect(data("ntCurrency0", 130000).value).toBe(130000);
    expect(data("shares", 2000).value).toBe(2000);
  });

  it("passes the symbol and date through", () => {
    expect(data("symbol", "2330").value).toBe("2330");
    expect(data("date", "2026-07-17").value).toBe("2026-07-17");
  });

  it("maps the boolean status onto a red/green enum value; null stays null", () => {
    expect(data("status", true).value).toBe(1);
    expect(data("status", false).value).toBe(0);
    expect(data("status", null).value).toBe(null);
  });

  it("produces read-only Custom cells: overlay off, empty flagged to draw —", () => {
    const c = cell("symbol", "2330");
    expect(c.kind).toBe(GridCellKind.Custom);
    expect(c.allowOverlay).toBe(false);
    expect(cell("status", true).allowOverlay).toBe(false);
    // A null value on a read-only cell carries the flag its renderer uses to draw "—".
    expect(data("ntCurrency2", null).value).toBe(null);
    expect(data("ntCurrency2", null).readOnly).toBe(true);
  });
});
