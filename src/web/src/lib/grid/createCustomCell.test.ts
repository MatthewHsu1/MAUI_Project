import { describe, expect, it } from "vitest";
import { drawEmptyDash, type CellDrawArgs } from "./createCustomCell";

function fakeCtx() {
  const calls: string[] = [];
  const ctx = {
    font: "",
    fillStyle: "" as string,
    textBaseline: "alphabetic" as CanvasTextBaseline,
    fillText: (t: string, x: number, y: number) => {
      calls.push(`fillText:${t}@${x},${y}`);
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, raw: ctx };
}

const theme = {
  textDark: "#111",
  textLight: "#999",
  baseFontFull: "13px sans-serif",
  cellHorizontalPadding: 8,
};

const rect = { x: 10, y: 0, width: 100, height: 34 };

function drawArgs(ctx: CanvasRenderingContext2D) {
  return { ctx, rect, theme } as unknown as CellDrawArgs<{ kind: string }>;
}

describe("drawEmptyDash", () => {
  it("paints an em dash in the muted text color at the padded left baseline", () => {
    const { ctx, calls, raw } = fakeCtx();

    drawEmptyDash(drawArgs(ctx));

    expect(raw.fillStyle).toBe("#999");
    expect(raw.font).toBe("13px sans-serif");
    expect(raw.textBaseline).toBe("middle");
    // x = rect.x + cellHorizontalPadding (10 + 8), y = rect.y + rect.height / 2 (0 + 17)
    expect(calls).toEqual(["fillText:—@18,17"]);
  });
});
