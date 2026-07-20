import type { CustomRenderer } from "@glideapps/glide-data-grid";
import {
  createCellRegistry,
  type CellContext,
  type CellRegistry,
  type CellTypeDef,
} from "../../lib/grid/cellRegistry";
import { createDateCell } from "../../lib/grid/createDateCell";
import { createEnumCell } from "../../lib/grid/createEnumCell";
import { createNumberCell } from "../../lib/grid/createNumberCell";
import { createTextCell } from "../../lib/grid/createTextCell";

// Shared cell primitives, built once at module scope (renderer/editor identity is
// tied to the create* call — never build these inside a React render). Every bond
// column is non-editable, so each `make` passes `ctx.editable` as `allowOverlay`
// (false here): the editor never opens and an empty value draws "—".
const symbolCell = createTextCell({ kind: "bond-symbol" });

const sharesCell = createNumberCell({
  kind: "bond-shares",
  format: "integer",
  thousandSeparator: true,
});

const nt0Cell = createNumberCell({
  kind: "bond-nt0",
  format: "currency",
  currency: "TWD",
  decimalScale: 0,
});

const nt2Cell = createNumberCell({
  kind: "bond-nt2",
  format: "currency",
  currency: "TWD",
  decimalScale: 2,
});

const dateCell = createDateCell({ kind: "bond-date", nullable: true });

const statusCell = createEnumCell({
  kind: "bond-status",
  nullable: true,
  options: [
    { value: 0, label: "Out of the money", color: "red" },
    { value: 1, label: "In the money", color: "green" },
  ],
});

const asNum = (raw: unknown): number | null => (raw == null ? null : Number(raw));
const asStr = (raw: unknown): string | null => (raw == null ? null : String(raw));

/**
 * Left unannotated (not `CellTypeDef[]`) so each `renderer` keeps its precise
 * `CustomRenderer<CustomCell<XCellData>>` type instead of widening to the
 * registry's unparameterized `CustomRenderer`. `make`'s parameters are
 * annotated by hand since they lose the `CellTypeDef` contextual type here.
 * Everything but `renderer` (`type`, `kind`, `make`'s params/return, `validate`)
 * is still checked structurally against `CellTypeDef` when this array is mapped
 * below — only the `renderer` field gets an escape hatch.
 */
const bondCellDefs = [
  {
    type: "symbol",
    kind: "bond-symbol",
    renderer: symbolCell.renderer,
    make: (raw: unknown, ctx: CellContext) => symbolCell.makeCell(asStr(raw), ctx.editable),
  },
  {
    type: "shares",
    kind: "bond-shares",
    renderer: sharesCell.renderer,
    make: (raw: unknown, ctx: CellContext) => sharesCell.makeCell(asNum(raw), ctx.editable),
  },
  {
    type: "ntCurrency0",
    kind: "bond-nt0",
    renderer: nt0Cell.renderer,
    make: (raw: unknown, ctx: CellContext) => nt0Cell.makeCell(asNum(raw), ctx.editable),
  },
  {
    type: "ntCurrency2",
    kind: "bond-nt2",
    renderer: nt2Cell.renderer,
    make: (raw: unknown, ctx: CellContext) => nt2Cell.makeCell(asNum(raw), ctx.editable),
  },
  {
    type: "date",
    kind: "bond-date",
    renderer: dateCell.renderer,
    make: (raw: unknown, ctx: CellContext) =>
      dateCell.makeCell(asStr(raw), ctx.withTime, ctx.editable),
  },
  {
    type: "status",
    kind: "bond-status",
    renderer: statusCell.renderer,
    make: (raw: unknown, ctx: CellContext) =>
      statusCell.makeCell(raw == null ? null : raw ? 1 : 0, ctx.editable),
  },
];

/**
 * Cell registry for the read-only convertible-bond grid, reusing the shared
 * lib/grid primitives. Column `type` keys: "symbol", "shares", "ntCurrency0",
 * "ntCurrency2", "date", "status". Each `make` builds its cell with
 * `allowOverlay: ctx.editable` — false for every bond column — so the cell is
 * non-editable and a null value renders as "—".
 */
// `bondCellDefs`'s renderers are typed per-cell (e.g.
// `CustomRenderer<CustomCell<TextCellData>>`), but `CellTypeDef.renderer` is
// the unparameterized `CustomRenderer<CustomCell<{}>>`. `strictFunctionTypes`
// makes those incomparable in either direction (the `draw`/`onPaste`
// parameters are contravariant), so a direct `as CellTypeDef[]` is rejected
// as non-overlapping. The escape hatch is narrowed to just the `renderer`
// field — via a per-def `as unknown as CustomRenderer` inside `.map` — instead
// of routing the whole array (and thus every other field: `type`, `kind`,
// `make`'s params/return, `validate`) through `unknown`. The `: CellTypeDef`
// return annotation on the mapper still checks all of those fields structurally;
// only `renderer`'s contravariant mismatch is suppressed. Runtime safety for
// that field is unaffected either way: routing (by `data.kind` via each
// renderer's `isMatch`) is what actually keeps this safe at runtime.
export const bondCells: CellRegistry = createCellRegistry(
  bondCellDefs.map((d): CellTypeDef => ({
    ...d,
    renderer: d.renderer as unknown as CustomRenderer,
  })),
);
