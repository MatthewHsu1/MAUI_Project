// src/features/dataGrid/headerIcons.ts
import type { SpriteMap } from "@glideapps/glide-data-grid";

/**
 * Sort chevrons for the column headers.
 *
 * Glide has no sort state of its own — it hands over `onHeaderClicked` and
 * nothing else — but it does own the header's rendering, so the indicator has
 * to go in through the slot it provides: a named sprite here, referenced by
 * `indicatorIcon` on the column. Drawing over the canvas ourselves would fight
 * the grid's own repaints.
 *
 * Sprites are SVG strings on the 20×20 box the built-in header icons use, and
 * are handed the resolved theme colours at paint time, so the chevron inherits
 * the header's foreground and stays right in light and dark without knowing
 * which is active.
 */

export const SORT_ASC_ICON = "sortAsc";
export const SORT_DESC_ICON = "sortDesc";

/**
 * A bare chevron: no box, no fill, 1.75px stroke with round joins. The header
 * already says which column this is — the indicator only has to say which way,
 * so it reads as punctuation on the title rather than a badge beside it.
 */
function chevron(fgColor: string, direction: "up" | "down"): string {
  const d = direction === "up" ? "M6.5 11.75 10 8.25l3.5 3.5" : "M6.5 8.25 10 11.75l3.5-3.5";

  return `<svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="${d}" stroke="${fgColor}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`;
}

/** Pass to `<DataEditor headerIcons=...>` to make the names above resolvable. */
export const sortHeaderIcons: SpriteMap = {
  // Ascending points up: the arrow follows the values, smallest at the top.
  [SORT_ASC_ICON]: (props) => chevron(props.fgColor, "up"),
  [SORT_DESC_ICON]: (props) => chevron(props.fgColor, "down"),
};
