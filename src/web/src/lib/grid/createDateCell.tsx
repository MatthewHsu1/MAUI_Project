import type { CustomCell, CustomRenderer } from "@glideapps/glide-data-grid";
import { Text, Theme } from "@radix-ui/themes";
import { useState, type ChangeEvent } from "react";
import { Calendar } from "../../components/ui/calendar";
import { Input } from "../../components/ui/input";
import { radixThemeConfig } from "../../theme/radixTheme";
import {
  composeIso,
  formatDateDisplay,
  isoToCalendarDate,
  isoToTimeInput,
  isValidDateValue,
  parseDatePaste,
} from "../date/dateUtils";
import {
  createCustomCell,
  drawEmptyDash,
  makeCustomCell,
  type EditorProps,
} from "./createCustomCell";

/** How many years before/after the current year the calendar's year dropdown spans. */
const CALENDAR_YEARS_BACK = 500;
const CALENDAR_YEARS_FORWARD = 500;

/** Cell payload. `value` is a canonical UTC ISO string, or null for an unset cell. */
export interface DateCellData {
  kind: string;
  value: string | null;
  withTime: boolean;
  readOnly?: boolean;
}

export interface DateCell {
  renderer: CustomRenderer<CustomCell<DateCellData>>;
  makeCell: (
    value: string | null,
    withTime: boolean,
    allowOverlay?: boolean,
  ) => CustomCell<DateCellData>;
  validate: (cell: CustomCell<DateCellData>) => boolean;
}

/**
 * Build a reusable date cell: a canvas text `draw` (localized date, or date+time
 * when the cell's `withTime` is set) plus a shadcn `Calendar` editor with an
 * optional native time input. Stores canonical UTC ISO strings.
 *
 * Call once at module scope (not inside a React render): the editor component
 * identity is tied to this call, so re-creating it per render would remount it.
 */
export function createDateCell({
  kind,
  nullable = false,
}: {
  kind: string;
  nullable?: boolean;
}): DateCell {
  const Editor = ({ value, onChange }: EditorProps<DateCellData>) => {
    const selected = isoToCalendarDate(value.value, value.withTime);
    const currentYear = new Date().getFullYear();

    const [time, setTime] = useState(isoToTimeInput(value.value));

    const handleDay = (day?: Date) => {
      if (!day) {
        // Deselect clears the cell only when empty is allowed (mirrors onPaste).
        if (nullable) {
          onChange({ ...value, value: null });
        }
        return;
      }
      onChange({ ...value, value: composeIso(day, time, value.withTime) });
    };

    const handleTime = (e: ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setTime(next);

      if (selected) {
        onChange({ ...value, value: composeIso(selected, next, value.withTime) });
      }
    };

    return (
      <Theme {...radixThemeConfig}>
        <div className="date-cell-editor" style={{ padding: 8, minWidth: 280 }}>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleDay}
            defaultMonth={selected}
            captionLayout="dropdown"
            startMonth={new Date(currentYear - CALENDAR_YEARS_BACK, 0)}
            endMonth={new Date(currentYear + CALENDAR_YEARS_FORWARD, 11)}
            autoFocus
          />
          {value.withTime && (
            <label className="mt-2 flex flex-col gap-1">
              <Text as="span" size="2" weight="medium">
                Time
              </Text>
              <Input
                type="time"
                value={time}
                onChange={handleTime}
                aria-label="Time"
                className="w-full"
              />
            </label>
          )}
        </div>
      </Theme>
    );
  };

  const renderer = createCustomCell<DateCellData>({
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
        formatDateDisplay(data.value, data.withTime),
        rect.x + theme.cellHorizontalPadding,
        rect.y + rect.height / 2,
      );
    },
    editor: Editor,
    onPaste: (val, data) => {
      const parsed = parseDatePaste(val, data.withTime);

      if (parsed === undefined) return undefined;
      if (parsed === null && !nullable) return undefined;

      return { ...data, value: parsed };
    },
  });

  const makeCell = (
    value: string | null,
    withTime: boolean,
    allowOverlay = true,
  ): CustomCell<DateCellData> =>
    makeCustomCell(
      { kind, value, withTime, ...(allowOverlay ? {} : { readOnly: true }) },
      value ?? "",
      allowOverlay,
    );

  const validate = (cell: CustomCell<DateCellData>): boolean =>
    isValidDateValue(cell.data.value, nullable);

  return { renderer, makeCell, validate };
}
