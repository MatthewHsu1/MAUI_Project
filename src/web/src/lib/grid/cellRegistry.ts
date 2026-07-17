import {
  GridCellKind,
  type CustomCell,
  type CustomRenderer,
  type GridCell,
} from "@glideapps/glide-data-grid";

/** Per-column-cell context the maker needs beyond the raw value. */
export interface CellContext {
  editable: boolean;
  withTime: boolean;
}

/**
 * One cell type. `type` keys the column→cell dispatch; `kind` (for custom cells)
 * is the runtime `cell.data.kind` used to route validation. Built-in cells omit
 * `kind`, `renderer`, and `validate`.
 */
export interface CellTypeDef {
  type: string;
  kind?: string;
  make: (raw: unknown, ctx: CellContext) => GridCell;
  renderer?: CustomRenderer;
  validate?: (cell: CustomCell<{ kind: string }>) => boolean;
}

export interface CellRegistry {
  makeCell: (type: string, raw: unknown, ctx: CellContext) => GridCell;
  customRenderers: CustomRenderer[];
  validateCell: (cell: GridCell) => boolean;
}

/**
 * Build a registry from cell-type defs. Derives the three things a grid needs
 * from one source of truth: a type→maker dispatch, the custom-renderer list, and
 * a kind→validator router. Adding a cell type means adding one def — no edits to
 * the column dispatch, the renderer array, or a validation if-chain.
 */
export function createCellRegistry(defs: CellTypeDef[]): CellRegistry {
  const byType = new Map(defs.map((d) => [d.type, d]));
  const validators = new Map<string, NonNullable<CellTypeDef["validate"]>>();

  for (const d of defs) {
    if (d.kind && d.validate) {
      validators.set(d.kind, d.validate);
    }
  }

  return {
    makeCell(type, raw, ctx) {
      const def = byType.get(type);

      if (!def) {
        throw new Error(`createCellRegistry: unknown cell type "${type}"`);
      }

      return def.make(raw, ctx);
    },

    customRenderers: defs
      .map((d) => d.renderer)
      .filter((r): r is CustomRenderer => r !== undefined),

    validateCell(cell) {
      if (cell.kind !== GridCellKind.Custom) {
        return true;
      }

      const data = (cell as CustomCell<{ kind: string }>).data;
      const v = validators.get(data.kind);

      return v ? v(cell as CustomCell<{ kind: string }>) : true;
    },
  };
}
