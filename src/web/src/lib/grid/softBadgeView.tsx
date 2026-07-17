import { Badge } from "@radix-ui/themes";
import type { RadixColor } from "./radixBadgePalette";

/** React soft badge (full-pill) — used in the edit dropdown trigger and items. */
export function SoftBadge({ color, label }: { color: RadixColor; label: string }) {
  return (
    <Badge color={color} variant="soft" radius="full">
      {label}
    </Badge>
  );
}
