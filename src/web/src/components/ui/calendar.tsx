import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { type ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import { type ChevronProps } from "react-day-picker";
import "react-day-picker/style.css";
import { cn } from "../../lib/utils";

export type CalendarProps = ComponentProps<typeof DayPicker>;

/**
 * shadcn-style Calendar: a thin react-day-picker wrapper. Accent colors come
 * from react-day-picker's own `--rdp-accent-color`, bound to Radix's `--accent-*`
 * in the `.date-cell-editor` scope (see index.css), so the calendar tracks the
 * app's Radix Themes config at runtime.
 */
export function Calendar({ className, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      components={{
        Chevron: ({ orientation }: ChevronProps) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "right"
                ? ChevronRight
                : orientation === "up"
                  ? ChevronUp
                  : ChevronDown;
          return <Icon className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}
