import type { CustomCell, CustomRenderer } from "@glideapps/glide-data-grid";
import { Select, Text, Theme } from "@radix-ui/themes";
import { radixThemeConfig } from "../../theme/radixTheme";
import { createCustomCell, makeCustomCell, type EditorProps } from "./createCustomCell";
import { radixColorByIndex, type RadixColor } from "./radixBadgePalette";
import { drawSoftBadge, SoftBadge } from "./softBadge";

/** One selectable enum value: numeric value, label, and an optional color override. */
export interface EnumOption {
  value: number;
  label: string;
  color?: RadixColor;
}

/** Cell payload stored in the grid. `kind` routes the renderer; `value` is the
 * enum, or `null` for an unset (cleared) cell on a nullable column. */
export interface EnumCellData {
  kind: string;
  value: number | null;
}

interface ResolvedOption {
  label: string;
  color: RadixColor;
}

export interface EnumCell {
  renderer: CustomRenderer<CustomCell<EnumCellData>>;
  makeCell: (value: number | null) => CustomCell<EnumCellData>;
  /** Resolved color for a value (override or index default). Exposed for tests/reuse. */
  colorOf: (value: number) => RadixColor;
}

/** Sentinel item value for the "clear" option in a nullable Select. Radix
 * reserves the empty string for items, so a non-empty sentinel is required. */
const NONE_VALUE = "__none__";

/**
 * Build a reusable enum cell: a canvas soft-badge `draw` plus a Radix `Select`
 * editor. Colors default to radixColorByIndex(value), overridable per option.
 * Each enum column must pass a unique `kind` so glide's isMatch routes correctly.
 *
 * Call this once at module scope (not inside a React render): the editor component
 * identity is tied to this call, so re-creating it per render would remount editors.
 */
export function createEnumCell({
  kind,
  options,
  nullable = false,
}: {
  kind: string;
  options: EnumOption[];
  nullable?: boolean;
}): EnumCell {
  const byValue = new Map<number, ResolvedOption>();

  for (const opt of options) {
    byValue.set(opt.value, { label: opt.label, color: opt.color ?? radixColorByIndex(opt.value) });
  }

  const lookup = (value: number): ResolvedOption =>
    byValue.get(value) ?? { label: String(value), color: radixColorByIndex(value) };

  const Editor = ({ value, onFinishedEditing }: EditorProps<EnumCellData>) => {
    const handleValueChange = (next: string) => {
      onFinishedEditing({ ...value, value: next === NONE_VALUE ? null : Number(next) });
    };

    return (
      <Theme {...radixThemeConfig}>
        <Select.Root
          // `undefined` (not "null") leaves the Select with nothing selected so
          // the placeholder shows for an unset cell.
          value={value.value == null ? undefined : String(value.value)}
          onValueChange={handleValueChange}
          defaultOpen
        >
          <Select.Trigger variant="soft" placeholder="—" />
          <Select.Content position="popper">
            {nullable && (
              <Select.Item value={NONE_VALUE}>
                <Text color="gray">None</Text>
              </Select.Item>
            )}
            {options.map((opt) => (
              <Select.Item key={opt.value} value={String(opt.value)}>
                <SoftBadge color={lookup(opt.value).color} label={opt.label} />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Theme>
    );
  };

  const renderer = createCustomCell<EnumCellData>({
    kind,
    draw: (args, data) => {
      if (data.value == null) return;

      const { label, color } = lookup(data.value);
      // Pass the grid's base font so drawSoftBadge measures with the same font it
      // renders (glide's FullTheme exposes the composed font as `baseFontFull`).
      drawSoftBadge(args.ctx, args.rect, color, label, args.theme.baseFontFull);
    },
    editor: Editor,
  });

  const makeCell = (value: number | null): CustomCell<EnumCellData> =>
    makeCustomCell({ kind, value }, value == null ? "" : lookup(value).label);

  return { renderer, makeCell, colorOf: (value) => lookup(value).color };
}
