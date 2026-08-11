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
import { createPhoneCell } from "../../lib/grid/createPhoneCell";
import { createTextCell } from "../../lib/grid/createTextCell";
import { REGIONS } from "./api/types";

// Shared cell primitives, built once at module scope. Renderer and editor
// identity is tied to the create* call, so building these inside a React render
// would remount the editor on every keystroke.
const textCell = createTextCell({ kind: "test-text" });

const intCell = createNumberCell({
  kind: "test-int",
  format: "integer",
  thousandSeparator: true,
  min: 0,
});

const currencyCell = createNumberCell({
  kind: "test-currency",
  format: "currency",
  currency: "USD",
  decimalScale: 2,
  min: 0,
});

const phoneCell = createPhoneCell({ kind: "test-phone", nullable: true, defaultCountry: "US" });

const dateCell = createDateCell({ kind: "test-date", nullable: true });

// Colors come from RADIX_BADGE_SCALES in lib/grid/radixBadgePalette.ts. That
// list is the whole `RadixColor` union — "blue", "purple", and "gray" are NOT
// in it, and each scale must also be imported in theme/radixStyles.ts.
const regionCell = createEnumCell({
  kind: "test-region",
  nullable: false,
  options: [
    { value: REGIONS[0].value, label: REGIONS[0].label, color: "cyan" },
    { value: REGIONS[1].value, label: REGIONS[1].label, color: "amber" },
    { value: REGIONS[2].value, label: REGIONS[2].label, color: "plum" },
  ],
});

const activeCell = createEnumCell({
  kind: "test-active",
  nullable: true,
  options: [
    { value: 0, label: "Inactive", color: "tomato" },
    { value: 1, label: "Active", color: "green" },
  ],
});

const asNum = (raw: unknown): number | null => (raw == null ? null : Number(raw));
const asStr = (raw: unknown): string | null => (raw == null ? null : String(raw));

/**
 * Left unannotated (not `CellTypeDef[]`) so each `renderer` keeps its precise
 * type instead of widening to the registry's unparameterized `CustomRenderer`.
 * See the same pattern, and the reason for the cast below, in
 * `features/bonds/bondCells.ts`.
 */
const testCellDefs = [
  {
    type: "text",
    kind: "test-text",
    renderer: textCell.renderer,
    make: (raw: unknown, ctx: CellContext) => textCell.makeCell(asStr(raw), ctx.editable),
  },
  {
    type: "int",
    kind: "test-int",
    renderer: intCell.renderer,
    make: (raw: unknown, ctx: CellContext) => intCell.makeCell(asNum(raw), ctx.editable),
  },
  {
    type: "currency",
    kind: "test-currency",
    renderer: currencyCell.renderer,
    make: (raw: unknown, ctx: CellContext) => currencyCell.makeCell(asNum(raw), ctx.editable),
  },
  {
    type: "region",
    kind: "test-region",
    renderer: regionCell.renderer,
    make: (raw: unknown, ctx: CellContext) => regionCell.makeCell(asNum(raw), ctx.editable),
  },
  {
    type: "phone",
    kind: "test-phone",
    renderer: phoneCell.renderer,
    make: (raw: unknown, ctx: CellContext) => phoneCell.makeCell(asStr(raw), ctx.editable),
  },
  {
    type: "date",
    kind: "test-date",
    renderer: dateCell.renderer,
    make: (raw: unknown, ctx: CellContext) =>
      dateCell.makeCell(asStr(raw), ctx.withTime, ctx.editable),
  },
  {
    type: "active",
    kind: "test-active",
    renderer: activeCell.renderer,
    make: (raw: unknown, ctx: CellContext) =>
      activeCell.makeCell(raw == null ? null : raw ? 1 : 0, ctx.editable),
  },
];

/**
 * Cell registry for the development test grid. Column `type` keys: "text",
 * "int", "currency", "region", "phone", "date", "active".
 *
 * Unlike `bondCells`, every `make` passes `ctx.editable` through as it comes, so
 * a column marked editable in the column def opens its editor.
 */
// The `renderer` cast is narrowed to that one field for the reason spelled out
// at the foot of `features/bonds/bondCells.ts`: `strictFunctionTypes` makes the
// per-cell renderer types and the registry's unparameterized `CustomRenderer`
// incomparable in either direction, and routing the whole def through `unknown`
// would drop the structural check on every other field. Runtime routing is by
// `data.kind` through each renderer's `isMatch`, which is unaffected.
export const testGridCells: CellRegistry = createCellRegistry(
  testCellDefs.map((d): CellTypeDef => ({
    ...d,
    renderer: d.renderer as unknown as CustomRenderer,
  })),
);
