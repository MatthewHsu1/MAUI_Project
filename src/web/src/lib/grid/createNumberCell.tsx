import type { CustomCell, CustomRenderer } from "@glideapps/glide-data-grid";
import { Theme } from "@radix-ui/themes";
import { radixThemeConfig } from "../../theme/radixTheme";
import { NumericInput } from "../../components/ui/numericInput";
import { createCustomCell, makeCustomCell, type EditorProps } from "./createCustomCell";
import {
  formatNumberDisplay,
  isValueInRange,
  parseNumberPaste,
  type NumberFormat,
} from "../number/numberUtils";

/** Cell payload. `value` is a JS number, or null for an unset cell. */
export interface NumberCellData {
  kind: string;
  value: number | null;
}

export interface NumberCell {
  renderer: CustomRenderer<CustomCell<NumberCellData>>;
  makeCell: (value: number | null, allowOverlay?: boolean) => CustomCell<NumberCellData>;
  validate: (cell: CustomCell<NumberCellData>) => boolean;
}

/**
 * Build a reusable numeric cell: a canvas text `draw` (formatted per options)
 * plus a `<NumericInput>` editor. Out-of-range entry is blocked in the editor;
 * `validate` and `onPaste` gate commits and pastes. Empty is allowed only when
 * `nullable`.
 *
 * Call once at module scope (not inside a React render): the editor component
 * identity is tied to this call, so re-creating it per render would remount it.
 */
export function createNumberCell({
  kind,
  nullable = false,
  format,
  decimalScale,
  currency,
  min,
  max,
  thousandSeparator,
  prefix,
  suffix,
}: {
  kind: string;
  nullable?: boolean;
  format?: NumberFormat;
  decimalScale?: number;
  currency?: string;
  min?: number;
  max?: number;
  thousandSeparator?: boolean;
  prefix?: string;
  suffix?: string;
}): NumberCell {
  const fmt = { format, decimalScale, currency, min, max, thousandSeparator, prefix, suffix };

  const Editor = ({ value, onChange }: EditorProps<NumberCellData>) => (
    <Theme {...radixThemeConfig}>
      <div style={{ padding: 8, minWidth: 200 }}>
        <NumericInput
          {...fmt}
          value={value.value}
          onChange={(next) => onChange({ ...value, value: next })}
          autoFocus
        />
      </div>
    </Theme>
  );

  const renderer = createCustomCell<NumberCellData>({
    kind,
    draw: (args, data) => {
      if (data.value == null) return;

      const { ctx, rect, theme } = args;
      ctx.fillStyle = theme.textDark;
      ctx.font = theme.baseFontFull;
      ctx.textBaseline = "middle";
      ctx.fillText(
        formatNumberDisplay(data.value, fmt),
        rect.x + theme.cellHorizontalPadding,
        rect.y + rect.height / 2,
      );
    },
    editor: Editor,
    onPaste: (val, data) => {
      const parsed = parseNumberPaste(val, { min, max, nullable });

      if (parsed === undefined) return undefined;

      return { ...data, value: parsed };
    },
  });

  const makeCell = (value: number | null, allowOverlay = true): CustomCell<NumberCellData> =>
    makeCustomCell({ kind, value }, value == null ? "" : String(value), allowOverlay);

  const validate = (cell: CustomCell<NumberCellData>): boolean => {
    const v = cell.data.value;

    if (v == null) return nullable;

    return isValueInRange(v, min, max);
  };

  return { renderer, makeCell, validate };
}
