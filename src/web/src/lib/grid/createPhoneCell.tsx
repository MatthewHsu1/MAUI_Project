import type { CustomCell, CustomRenderer } from "@glideapps/glide-data-grid";
import { Text, Theme } from "@radix-ui/themes";
import PhoneInput, { type Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { radixThemeConfig } from "../../theme/radixTheme";
import { formatPhoneDisplay, isValidPhoneValue, parsePhonePaste } from "../phone/phoneUtils";
import {
  createCustomCell,
  drawEmptyDash,
  makeCustomCell,
  type EditorProps,
} from "./createCustomCell";

/** Cell payload. `value` is a canonical E.164 string, or null for an unset cell. */
export interface PhoneCellData {
  kind: string;
  value: string | null;
  readOnly?: boolean;
}

export interface PhoneCell {
  renderer: CustomRenderer<CustomCell<PhoneCellData>>;
  makeCell: (value: string | null, allowOverlay?: boolean) => CustomCell<PhoneCellData>;
  validate: (cell: CustomCell<PhoneCellData>) => boolean;
}

/**
 * Build a reusable phone-number cell: a canvas text `draw` (international format)
 * plus a `react-phone-number-input` editor. Stores canonical E.164 strings.
 * Empty is allowed only when `nullable`; any non-empty value must be valid.
 *
 * Call once at module scope (not inside a React render): the editor component
 * identity is tied to this call, so re-creating it per render would remount it.
 */
export function createPhoneCell({
  kind,
  nullable = false,
  defaultCountry = "US",
}: {
  kind: string;
  nullable?: boolean;
  defaultCountry?: Country;
}): PhoneCell {
  const Editor = ({ value, onChange, isValid }: EditorProps<PhoneCellData>) => {
    const handleChange = (next?: string) => {
      // PhoneInput emits E.164 (or undefined when cleared). Live-sync to glide;
      // glide commits this value on overlay close, gated by validateCell.
      onChange({ ...value, value: next ?? null });
    };

    const invalid = isValid === false;

    return (
      <Theme {...radixThemeConfig}>
        <div style={{ padding: 8, minWidth: 240 }}>
          <div
            style={{
              border: `1px solid ${invalid ? "var(--red-9)" : "transparent"}`,
              borderRadius: 6,
              padding: 4,
            }}
          >
            <PhoneInput
              defaultCountry={defaultCountry}
              international
              value={value.value ?? undefined}
              onChange={handleChange}
              autoFocus
            />
          </div>
          {invalid && (
            <Text size="1" color="red" style={{ display: "block", marginTop: 4 }}>
              Invalid phone number
            </Text>
          )}
        </div>
      </Theme>
    );
  };

  const renderer = createCustomCell<PhoneCellData>({
    kind,
    draw: (args, data) => {
      if (data.value == null || data.value === "") {
        if (data.readOnly) drawEmptyDash(args);
        return;
      }

      const { ctx, rect, theme } = args;
      ctx.fillStyle = theme.textDark;
      ctx.font = theme.baseFontFull;
      ctx.textBaseline = "middle";
      ctx.fillText(
        formatPhoneDisplay(data.value, defaultCountry),
        rect.x + theme.cellHorizontalPadding,
        rect.y + rect.height / 2,
      );
    },
    editor: Editor,
    onPaste: (val, data) => {
      const parsed = parsePhonePaste(val, defaultCountry);

      if (parsed === undefined) return undefined;
      if (parsed === null && !nullable) return undefined;

      return { ...data, value: parsed };
    },
  });

  const makeCell = (value: string | null, allowOverlay = true): CustomCell<PhoneCellData> =>
    makeCustomCell(
      { kind, value, ...(allowOverlay ? {} : { readOnly: true }) },
      value ?? "",
      allowOverlay,
    );

  const validate = (cell: CustomCell<PhoneCellData>): boolean =>
    isValidPhoneValue(cell.data.value, nullable);

  return { renderer, makeCell, validate };
}
