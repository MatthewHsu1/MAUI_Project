export interface Boundary<TGroup> {
  dataIndex: number;
  group: TGroup;
}

interface Segment<TGroup> {
  group: TGroup | null;
  collapsed: boolean;
  hasHeader: boolean;
  dataStart: number;
  dataCount: number;
  displayStart: number;
}

export interface DisplayModel<TGroup> {
  rowCount: number;
  segments: Segment<TGroup>[];
}

export interface BuildArgs<TGroup> {
  boundaries: Boundary<TGroup>[];
  total: number;
  collapsedGroups: TGroup[];
  discoveredGroups: TGroup[];
}

export type DisplayCell<TGroup> =
  { kind: "header"; group: TGroup } | { kind: "data"; dataIndex: number };

/**
 * Detect group boundaries in a freshly loaded window. `windowSkip` is the global
 * data index of rows[0]; `precedingGroupKey` is the group of the row at
 * (windowSkip - 1), or null at the top. `groupOf` extracts a row's group.
 * Contract for non-zero-skip windows: when windowSkip > 0 and precedingGroupKey
 * is null, the first-row boundary is NOT emitted (callers must supply
 * precedingGroupKey for paged-in windows).
 */
export function detectBoundaries<TRow, TGroup>(
  rows: TRow[],
  precedingGroupKey: TGroup | null,
  windowSkip: number,
  groupOf: (row: TRow) => TGroup,
): Boundary<TGroup>[] {
  const out: Boundary<TGroup>[] = [];
  let prev = precedingGroupKey;

  for (let i = 0; i < rows.length; i++) {
    const g = groupOf(rows[i]);
    const globalIndex = windowSkip + i;

    if (globalIndex === 0 && prev === null) {
      out.push({ dataIndex: 0, group: g });
    } else if (prev !== null && g !== prev) {
      out.push({ dataIndex: globalIndex, group: g });
    }
    prev = g;
  }
  return out;
}

/** Grouped model: data rows + one header per present group + one header per
 *  collapsed (remembered) group, ordered by `order(group)`. */
export function buildDisplayModel<TGroup>(
  args: BuildArgs<TGroup>,
  order: (g: TGroup) => number,
): DisplayModel<TGroup> {
  const collapsed = new Set(args.collapsedGroups);
  const sorted = [...args.boundaries].sort((a, b) => a.dataIndex - b.dataIndex);

  const present: Segment<TGroup>[] = sorted.map((b, i) => {
    const nextStart = i + 1 < sorted.length ? sorted[i + 1].dataIndex : args.total;
    return {
      group: b.group,
      collapsed: false,
      hasHeader: true,
      dataStart: b.dataIndex,
      dataCount: Math.max(0, nextStart - b.dataIndex),
      displayStart: 0,
    };
  });

  const presentGroups = new Set(present.map((s) => s.group));
  const collapsedSegments: Segment<TGroup>[] = [...new Set(args.discoveredGroups)]
    .filter((g) => collapsed.has(g) && !presentGroups.has(g))
    .map((g) => ({
      group: g,
      collapsed: true,
      hasHeader: true,
      dataStart: 0,
      dataCount: 0,
      displayStart: 0,
    }));

  const segments = [...present, ...collapsedSegments].sort(
    (a, b) => order(a.group as TGroup) - order(b.group as TGroup),
  );

  let display = 0;
  for (const s of segments) {
    s.displayStart = display;
    display += (s.hasHeader ? 1 : 0) + s.dataCount;
  }
  return { rowCount: display, segments };
}

/** Flat model for ungrouped grids: one headerless segment, display index === data index. */
export function buildFlatModel(total: number): DisplayModel<never> {
  return {
    rowCount: total,
    segments:
      total === 0
        ? []
        : [
            {
              group: null,
              collapsed: false,
              hasHeader: false,
              dataStart: 0,
              dataCount: total,
              displayStart: 0,
            },
          ],
  };
}

export function displayToData<TGroup>(
  model: DisplayModel<TGroup>,
  displayIndex: number,
): DisplayCell<TGroup> {
  for (const s of model.segments) {
    const headerRows = s.hasHeader ? 1 : 0;
    if (s.hasHeader && displayIndex === s.displayStart) {
      return { kind: "header", group: s.group as TGroup };
    }

    const dataStartDisplay = s.displayStart + headerRows;
    if (displayIndex >= dataStartDisplay && displayIndex < dataStartDisplay + s.dataCount) {
      return { kind: "data", dataIndex: s.dataStart + (displayIndex - dataStartDisplay) };
    }
  }

  // Defensive fallback. Reached at most at displayIndex === rowCount
  // (a one-past-end prefetch hint); benign slight over-prefetch near the bottom.
  return { kind: "data", dataIndex: displayIndex };
}

export function dataToDisplay<TGroup>(model: DisplayModel<TGroup>, dataIndex: number): number {
  for (const s of model.segments) {
    if (!s.collapsed && dataIndex >= s.dataStart && dataIndex < s.dataStart + s.dataCount) {
      return s.displayStart + (s.hasHeader ? 1 : 0) + (dataIndex - s.dataStart);
    }
  }
  return dataIndex;
}

export function groupOfDataIndex<TGroup>(
  model: DisplayModel<TGroup>,
  dataIndex: number,
): TGroup | null {
  for (const s of model.segments) {
    if (!s.collapsed && dataIndex >= s.dataStart && dataIndex < s.dataStart + s.dataCount) {
      return s.group;
    }
  }

  const last = model.segments[model.segments.length - 1];
  return last ? last.group : null;
}
