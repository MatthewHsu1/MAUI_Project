import type { CustomCell, CustomRenderer } from "@glideapps/glide-data-grid";
import { Text, Theme } from "@radix-ui/themes";
import { Input } from "../../components/ui/input";
import { radixThemeConfig } from "../../theme/radixTheme";
import { validateText, type TextValidationOptions } from "../text/textValidation";
import {
  createCustomCell,
  drawEmptyDash,
  makeCustomCell,
  type EditorProps,
} from "./createCustomCell";

/** Cell payload. `value` is the text string, or null for an unset cell. */
export interface TextCellData {
  kind: string;
  value: string | null;
  readOnly?: boolean;
}

export interface TextCell {
  renderer: CustomRenderer<CustomCell<TextCellData>>;
  makeCell: (value: string | null, allowOverlay?: boolean) => CustomCell<TextCellData>;
  validate: (cell: CustomCell<TextCellData>) => boolean;
}

/**
 * Build a reusable text cell: a canvas text `draw` plus an `<Input>` editor with
 * configurable validation. The editor shows the first failing rule's message;
 * `validate` gates commit; `onPaste` accepts the trimmed string (commit-gated).
 * `validation.required` plays the role of the number/phone cells' `nullable`.
 *
 * Call once at module scope (not inside a React render): the editor component
 * identity is tied to this call, so re-creating it per render would remount it.
 */
export function createTextCell({
  kind,
  validation = {},
}: {
  kind: string;
  validation?: TextValidationOptions;
}): TextCell {
  const Editor = ({ value, onChange, isValid }: EditorProps<TextCellData>) => {
    const text = value.value ?? "";

    const result = validateText(text, validation);
    const error = result.valid ? null : result.error;

    const invalid = isValid === false;

    return (
      <Theme {...radixThemeConfig}>
        <div style={{ padding: 8, minWidth: 240 }}>
          <Input
            value={text}
            maxLength={validation.maxLength}
            onChange={(e) =>
              onChange({ ...value, value: e.target.value === "" ? null : e.target.value })
            }
            autoFocus
            style={invalid ? { borderColor: "var(--red-9)" } : undefined}
          />
          {invalid && error && (
            <Text size="1" color="red" style={{ display: "block", marginTop: 4 }}>
              {error}
            </Text>
          )}
        </div>
      </Theme>
    );
  };

  const renderer = createCustomCell<TextCellData>({
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
      ctx.fillText(data.value, rect.x + theme.cellHorizontalPadding, rect.y + rect.height / 2);
    },
    editor: Editor,
    onPaste: (val, data) => {
      const trimmed = val.trim();
      return { ...data, value: trimmed === "" ? null : trimmed };
    },
  });

  const makeCell = (value: string | null, allowOverlay = true): CustomCell<TextCellData> =>
    makeCustomCell(
      { kind, value, ...(allowOverlay ? {} : { readOnly: true }) },
      value ?? "",
      allowOverlay,
    );

  const validate = (cell: CustomCell<TextCellData>): boolean =>
    validateText(cell.data.value ?? "", validation).valid;

  return { renderer, makeCell, validate };
}
