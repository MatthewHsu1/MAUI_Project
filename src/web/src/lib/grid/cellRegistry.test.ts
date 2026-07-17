import { describe, expect, it } from "vitest";
import { GridCellKind, type CustomCell, type GridCell } from "@glideapps/glide-data-grid";
import { createCellRegistry, type CellTypeDef } from "./cellRegistry";

const textCell = (s: string): GridCell => ({
  kind: GridCellKind.Text,
  data: s,
  displayData: s,
  allowOverlay: false,
});

const defs: CellTypeDef[] = [
  { type: "text", make: (raw) => textCell(String(raw ?? "")) },
  {
    type: "phone",
    kind: "phone",
    make: (raw) => ({
      kind: GridCellKind.Custom,
      allowOverlay: true,
      copyData: String(raw ?? ""),
      data: { kind: "phone", value: raw ?? null },
    }),
    renderer: {
      kind: GridCellKind.Custom,
      isMatch: () => true,
      draw: () => {},
      provideEditor: () => undefined,
    } as never,
    validate: (cell) => (cell.data as unknown as { value: unknown }).value !== "bad",
  },
];

describe("createCellRegistry", () => {
  it("makeCell dispatches by column type", () => {
    const r = createCellRegistry(defs);
    expect(r.makeCell("text", "hi", { editable: false, withTime: false })).toMatchObject({
      data: "hi",
    });
  });

  it("collects only defined renderers", () => {
    const r = createCellRegistry(defs);
    expect(r.customRenderers).toHaveLength(1);
  });

  it("validateCell routes custom cells by kind and passes everything else", () => {
    const r = createCellRegistry(defs);
    const good = {
      kind: GridCellKind.Custom,
      data: { kind: "phone", value: "ok" },
      copyData: "",
      allowOverlay: true,
    } as unknown as CustomCell<{ kind: string }>;
    const bad = {
      kind: GridCellKind.Custom,
      data: { kind: "phone", value: "bad" },
      copyData: "",
      allowOverlay: true,
    } as unknown as CustomCell<{ kind: string }>;
    const unknown = {
      kind: GridCellKind.Custom,
      data: { kind: "mystery" },
      copyData: "",
      allowOverlay: true,
    } as unknown as CustomCell<{ kind: string }>;
    expect(r.validateCell(good)).toBe(true);
    expect(r.validateCell(bad)).toBe(false);
    expect(r.validateCell(unknown)).toBe(true); // no validator → valid
    expect(r.validateCell(textCell("x"))).toBe(true); // non-custom → valid
  });

  it("throws on an unknown column type (fail fast, not a blank cell)", () => {
    const r = createCellRegistry(defs);
    expect(() => r.makeCell("nope", 1, { editable: false, withTime: false })).toThrow(
      /unknown cell type/i,
    );
  });
});
