import { useState } from "react";
import type { GridCell } from "@glideapps/glide-data-grid";

export interface EditHighlight {
  /** Record that the cell identified by `key` was just edited. */
  markEdited: (key: string) => void;
  /** Stamp `cell` with `lastUpdated` if `key` was recently edited, else return it unchanged. */
  withHighlight: (key: string, cell: GridCell) => GridCell;
}

/**
 * Pure (React-free) core: tracks edit timestamps per stable cell key and stamps
 * matching cells with Glide's `lastUpdated`, which the grid renders as a
 * highlighted background that fades out on its own.
 *
 * `now` is injectable for tests; in the browser it defaults to performance.now(),
 * which is what Glide compares `lastUpdated` against (not Date.now()).
 */
export function createEditHighlight(now: () => number = () => performance.now()): EditHighlight {
  const editedAt = new Map<string, number>();

  return {
    markEdited(key: string): void {
      editedAt.set(key, now());
    },
    withHighlight(key: string, cell: GridCell): GridCell {
      const lastUpdated = editedAt.get(key);
      return lastUpdated === undefined ? cell : { ...cell, lastUpdated };
    },
  };
}

/**
 * React hook wrapper. Keys edits by a caller-supplied stable identity
 * (e.g. `${dataIndex}:${field}`) rather than grid coordinates, so the highlight
 * follows the data through sorting, grouping, and windowing instead of staying
 * pinned to a screen position.
 *
 * Usage:
 *   const { markEdited, withHighlight } = useEditHighlight()
 *   // in getCellContent: return withHighlight(key, dataCell(row, field))
 *   // in onCellEdited:   markEdited(key)
 */
export function useEditHighlight(): EditHighlight {
  // Lazy initializer runs once; the instance is stable for the component's
  // lifetime and its methods are stable references.
  const [highlight] = useState(createEditHighlight);
  return highlight;
}
