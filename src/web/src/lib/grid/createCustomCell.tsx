import {
  type CustomCell,
  type CustomRenderer,
  type DrawArgs,
  GridCellKind,
} from "@glideapps/glide-data-grid";
import type * as React from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

/** The canvas draw args passed to your draw function. */
export type CellDrawArgs<TData extends { kind: string }> = DrawArgs<CustomCell<TData>>;

/** Props your editor component receives. */
export interface EditorProps<TData> {
  value: TData;
  onChange: (updated: TData) => void;
  onFinishedEditing: (updated?: TData) => void;
  isValid?: boolean;
}

/** Config you pass to createCustomCell. */
export interface CustomCellConfig<TData extends { kind: string }> {
  /** Unique string identifier for this cell type. Must match `cell.data.kind`. */
  kind: TData["kind"];

  /**
   * Canvas draw function. Receives the standard GDG draw args plus your
   * typed cell data for convenience.
   *
   * @example
   * draw: (args, data) => {
   *   const { ctx, rect, theme } = args;
   *   ctx.fillStyle = theme.textDark;
   *   ctx.fillText(data.label, rect.x + 8, rect.y + rect.height / 2);
   * }
   */
  draw: (args: CellDrawArgs<TData>, data: TData) => void;

  /**
   * React component rendered in the edit overlay. Receives the cell's typed
   * data, a live `onChange` to update the in-progress value, and
   * `onFinishedEditing` to commit (with a value) or cancel (undefined).
   *
   * @example
   * editor: ({ value, onChange }) => (
   *   <input
   *     defaultValue={value.text}
   *     onChange={e => onChange({ ...value, text: e.target.value })}
   *   />
   * )
   */
  editor: React.FC<EditorProps<TData>>;

  /**
   * Optional. Handle a clipboard paste into this cell. `val` is the pasted
   * string; return the new typed data, or `undefined` to reject the paste.
   * Omit if the cell is not pasteable.
   */
  onPaste?: (val: string, data: TData) => TData | undefined;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Creates a GDG CustomRenderer from a draw function and a React editor component.
 *
 * @example
 * const myRenderer = createCustomCell({
 *   kind: "my-cell",
 *   draw: (args, data) => { ... },
 *   editor: MyEditorComponent,
 * });
 *
 * // Then pass to DataEditor:
 * <DataEditor customRenderers={[myRenderer]} ... />
 */
export function createCustomCell<TData extends { kind: string }>(
  config: CustomCellConfig<TData>,
): CustomRenderer<CustomCell<TData>> {
  const { kind, draw, editor: EditorComponent, onPaste } = config;

  return {
    kind: GridCellKind.Custom,

    isMatch: (cell): cell is CustomCell<TData> => (cell.data as TData).kind === kind,

    draw: (args, cell) => draw(args, cell.data as TData),

    provideEditor:
      () =>
      ({ value: cell, onChange, onFinishedEditing, isValid }) => {
        const handleChange = (updated: TData) => {
          onChange({ ...cell, data: updated } as CustomCell<TData>);
        };

        const handleFinish = (updated?: TData) => {
          onFinishedEditing(
            updated === undefined ? undefined : ({ ...cell, data: updated } as CustomCell<TData>),
          );
        };

        return (
          <EditorComponent
            value={cell.data as TData}
            onChange={handleChange}
            onFinishedEditing={handleFinish}
            isValid={isValid}
          />
        );
      },

    ...(onPaste && {
      onPaste: (val: string, data: TData) => onPaste(val, data),
    }),
  };
}

// ─── Helper: read-only placeholder ───────────────────────────────────────────

/**
 * Paint an em dash ("—") in the muted text color at the cell's padded left edge —
 * the placeholder a read-only cell draws for a null/empty value (an editable cell
 * draws blank instead, inviting entry). Centralizes the look every value cell
 * uses for a missing read-only value.
 */
export function drawEmptyDash<TData extends { kind: string }>(args: CellDrawArgs<TData>): void {
  const { ctx, rect, theme } = args;
  ctx.fillStyle = theme.textLight;
  ctx.font = theme.baseFontFull;
  ctx.textBaseline = "middle";
  ctx.fillText("—", rect.x + theme.cellHorizontalPadding, rect.y + rect.height / 2);
}

// ─── Helper: build a cell payload ────────────────────────────────────────────

/**
 * Convenience function to build the full GDG cell object for a custom cell.
 *
 * `copyData` is the plain-text representation used when the cell is copied to
 * the clipboard. Provide a meaningful value so copy/paste and CSV export work.
 *
 * @example
 * const cell = makeCustomCell({ kind: "star-cell", rating: 4 }, "4");
 */
export function makeCustomCell<TData extends { kind: string }>(
  data: TData,
  copyData = "",
  allowOverlay = true,
): CustomCell<TData> {
  return {
    kind: GridCellKind.Custom,
    allowOverlay,
    copyData,
    data,
  };
}
