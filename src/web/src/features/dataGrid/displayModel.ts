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

  /**
   * The group that owns the data rows BEFORE the first boundary, or null when
   * nothing is known about them.
   *
   * `detectBoundaries` reports where a group STARTS, and it can only see the
   * rows of one loaded window. A window that sits wholly inside one group holds
   * no group change, so it reports no boundary at all — and a group of 10,000
   * rows read 300 at a time gives about 33 such windows in a row. Every data row
   * before the first boundary therefore belongs to a group this build cannot
   * place from `boundaries` alone.
   *
   * `LoadedSpan.precedingGroupKey` is that group: the group of the row directly
   * above the window. It is what lets the leading run keep its rows. Without it
   * the build made no segment for those rows, `rowCount` fell to 0, and the grid
   * drew nothing — which then stopped any new viewport range from committing,
   * because `dataRangeInDisplayRange` needs a segment to report a range. The
   * grid could not recover on its own.
   */
  leadingGroup: TGroup | null;

  total: number;
  collapsedGroups: TGroup[];
  discoveredGroups: TGroup[];
}

export type DisplayCell<TGroup> =
  { kind: "header"; group: TGroup } | { kind: "data"; dataIndex: number };

/** Display rows a segment spends on its header. */
function headerRowCount<TGroup>(segment: Segment<TGroup>): number {
  return segment.hasHeader ? 1 : 0;
}

/** Display index of a segment's first data row. */
function dataStartInDisplay<TGroup>(segment: Segment<TGroup>): number {
  return segment.displayStart + headerRowCount(segment);
}

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
  const boundaries: Boundary<TGroup>[] = [];
  let previousGroup = precedingGroupKey;

  rows.forEach((row, offset) => {
    const group = groupOf(row);
    const dataIndex = windowSkip + offset;

    const startsTheData = dataIndex === 0 && previousGroup === null;
    const groupChanged = previousGroup !== null && group !== previousGroup;

    if (startsTheData || groupChanged) {
      boundaries.push({ dataIndex, group });
    }

    previousGroup = group;
  });

  return boundaries;
}

/** One segment per boundary. A segment runs to the next boundary, or to `total`. */
function buildPresentSegments<TGroup>(
  boundaries: Boundary<TGroup>[],
  total: number,
): Segment<TGroup>[] {
  const sorted = [...boundaries].sort((a, b) => a.dataIndex - b.dataIndex);

  return sorted.map((boundary, i) => {
    const nextStart = i + 1 < sorted.length ? sorted[i + 1].dataIndex : total;

    return {
      group: boundary.group,
      collapsed: false,
      hasHeader: true,
      dataStart: boundary.dataIndex,
      dataCount: Math.max(0, nextStart - boundary.dataIndex),
      displayStart: 0,
    };
  });
}

/**
 * The segment for the data rows that sit before the first boundary, or null
 * when there are none.
 *
 * It carries NO header. A boundary is the only thing that says where a group
 * starts, and this run exists because no boundary for its group has loaded, so
 * drawing a header at data index 0 would claim a start this build cannot know.
 * The run therefore holds display index === data index, exactly as the
 * ungrouped model does, and it gains its header the moment a window loads the
 * boundary itself.
 *
 * Its group may be null. That happens while a moved window is still loading:
 * the span is empty, so it offers neither a boundary nor a preceding group. The
 * rows still have to be drawn, because a grid that draws nothing never commits
 * another viewport range and never asks for the rows that would fill it.
 */
function buildLeadingSegment<TGroup>(
  args: BuildArgs<TGroup>,
  present: Segment<TGroup>[],
): Segment<TGroup> | null {
  const firstStart = present.length > 0 ? present[0].dataStart : args.total;

  if (firstStart <= 0) {
    return null;
  }

  return {
    group: args.leadingGroup,
    collapsed: false,
    hasHeader: false,
    dataStart: 0,
    dataCount: firstStart,
    displayStart: 0,
  };
}

/** A header-only segment for each collapsed group that has no loaded rows. */
function buildCollapsedSegments<TGroup>(
  args: BuildArgs<TGroup>,
  present: Segment<TGroup>[],
): Segment<TGroup>[] {
  const collapsed = new Set(args.collapsedGroups);
  const presentGroups = new Set(present.map((segment) => segment.group));

  return [...new Set(args.discoveredGroups)]
    .filter((group) => collapsed.has(group) && !presentGroups.has(group))
    .map((group) => ({
      group,
      collapsed: true,
      hasHeader: true,
      dataStart: 0,
      dataCount: 0,
      displayStart: 0,
    }));
}

/** Stack the segments in display space. Returns the total display row count. */
function assignDisplayStarts<TGroup>(segments: Segment<TGroup>[]): number {
  let nextStart = 0;

  for (const segment of segments) {
    segment.displayStart = nextStart;
    nextStart += headerRowCount(segment) + segment.dataCount;
  }

  return nextStart;
}

/**
 * Grouped model: data rows + one header per present group + one header per
 * collapsed (remembered) group, ordered by `order(group)`.
 *
 * EVERY data row gets a segment, and that is the rule this build is written
 * around. A boundary can only be detected from a row that has loaded (see
 * `detectBoundaries`), so the boundaries alone describe a fraction of the list:
 * none at all on a cold start, and none again on any window that sits inside a
 * single group. The rows below the first boundary are the rest, and
 * `buildLeadingSegment` covers them.
 *
 * The rule is not cosmetic. A row with no segment is a row `rowCount` does not
 * count, so the grid draws nothing; and a grid that draws nothing reports no
 * visible region, so no viewport range commits and no request goes out for the
 * rows that would fix it. The grid deadlocks rather than flickering.
 */
export function buildDisplayModel<TGroup>(
  args: BuildArgs<TGroup>,
  order: (g: TGroup) => number,
): DisplayModel<TGroup> {
  const present = buildPresentSegments(args.boundaries, args.total);
  const leading = buildLeadingSegment(args, present);

  const placed = leading ? [leading, ...present] : present;
  const collapsedOnly = buildCollapsedSegments(args, placed);

  const segments = sortByGroupOrder([...placed, ...collapsedOnly], order);
  const rowCount = assignDisplayStarts(segments);

  return { rowCount, segments };
}

/**
 * Orders the segments the way the grid draws them.
 *
 * Only the leading segment may carry a null group, and only while a moved
 * window is still loading. `order` cannot rank it, and it covers data index 0,
 * so it stays first.
 */
function sortByGroupOrder<TGroup>(
  segments: Segment<TGroup>[],
  order: (g: TGroup) => number,
): Segment<TGroup>[] {
  return [...segments].sort((a, b) => {
    if (a.group === null || b.group === null) {
      return a.group === b.group ? 0 : a.group === null ? -1 : 1;
    }

    return order(a.group) - order(b.group);
  });
}

/** Flat model for ungrouped grids: one headerless segment, display index === data index. */
export function buildFlatModel(total: number): DisplayModel<never> {
  if (total === 0) {
    return { rowCount: 0, segments: [] };
  }

  const segment: Segment<never> = {
    group: null,
    collapsed: false,
    hasHeader: false,
    dataStart: 0,
    dataCount: total,
    displayStart: 0,
  };

  return { rowCount: total, segments: [segment] };
}

export function displayToData<TGroup>(
  model: DisplayModel<TGroup>,
  displayIndex: number,
): DisplayCell<TGroup> {
  for (const segment of model.segments) {
    if (segment.hasHeader && displayIndex === segment.displayStart) {
      return { kind: "header", group: segment.group as TGroup };
    }

    const offset = displayIndex - dataStartInDisplay(segment);

    if (offset >= 0 && offset < segment.dataCount) {
      return { kind: "data", dataIndex: segment.dataStart + offset };
    }
  }

  // Defensive fallback. Reached at most at displayIndex === rowCount
  // (a one-past-end prefetch hint); benign slight over-prefetch near the bottom.
  return { kind: "data", dataIndex: displayIndex };
}

/**
 * The first data index that a collapse or an expand of this group moves.
 *
 * A collapse drops the group's rows, so every index from its first row changes.
 * An expand puts the same rows back in the same place. Either way the rows
 * ABOVE it keep the index they already hold, and that is what a caller carries
 * across.
 *
 * Answers with 0 — "everything moves" — whenever the model cannot tell. That is
 * the safe direction: it costs a reload, and the opposite would show a row
 * under an index it does not belong to.
 */
export function firstAffectedDataIndex<TGroup>(model: DisplayModel<TGroup>, group: TGroup): number {
  const holdsRows = (segment: Segment<TGroup>) => segment.dataCount > 0;

  const at = model.segments.findIndex((segment) => segment.group === group);

  if (at < 0) {
    return 0;
  }

  const segment = model.segments[at];

  if (holdsRows(segment)) {
    return segment.dataStart;
  }

  // A collapsed group holds no rows, so its own `dataStart` is 0 and means
  // nothing. Its rows return directly after the last group above it that does
  // hold some — but the model may only say so when it also places rows BELOW
  // the collapsed group.
  //
  // The last segment that holds rows always runs to `total`, whether the rows
  // under it have loaded or not. So `dataStart + dataCount` on that segment is
  // the end of the TABLE, not the end of the group, and reading it as a
  // boundary would carry every loaded page across a move. A segment placed
  // below the collapsed group is the proof that the segment above it ends at a
  // real boundary. Without that proof the answer is 0: everything moves.
  const above = model.segments.slice(0, at).filter(holdsRows).pop();
  const anyBelow = model.segments.slice(at + 1).some(holdsRows);

  if (above === undefined || !anyBelow) {
    return 0;
  }

  return above.dataStart + above.dataCount;
}

/**
 * The display rows that show a set of data indexes, ascending.
 *
 * A group header occupies a display row, so in a grouped grid a data index and
 * a display row are different numbers. Glide numbers everything it draws — and
 * everything it DAMAGES — in display space, while both writers of the grid's
 * damage callback speak data indexes: the page loader reports absolute store
 * indexes, and a settled save finds its row with `RowStore.indexOfKey`. Without
 * this translation a repaint lands on some other row, or on a header, and the
 * row that actually changed is left as it was.
 *
 * An index the model does not place is DROPPED rather than damaged at a guessed
 * row. A collapsed group's rows and a page that loaded past the current total
 * both reach here, and there is no display row showing them.
 *
 * It walks the segments ONCE for the whole batch rather than searching them per
 * index, because a page load hands over a page of indexes at a time. An
 * ungrouped grid is one headerless segment starting at data index 0, so every
 * answer is `index` and the mapping is the identity, at one subtraction and one
 * addition per index.
 */
export function displayRowsOfData<TGroup>(
  model: DisplayModel<TGroup>,
  dataIndexes: readonly number[],
): number[] {
  if (dataIndexes.length === 0) {
    return [];
  }

  // A copy, never the model's own array. Collapsed and empty segments show no
  // data row at all, so nothing can map into them.
  const placed = model.segments
    .filter((segment) => !segment.collapsed && segment.dataCount > 0)
    .sort((a, b) => a.dataStart - b.dataStart);

  if (placed.length === 0) {
    return [];
  }

  const ascending = [...dataIndexes].sort((a, b) => a - b);
  const displayRows: number[] = [];

  let current = 0;

  for (const dataIndex of ascending) {
    while (
      current < placed.length &&
      dataIndex >= placed[current].dataStart + placed[current].dataCount
    ) {
      current += 1;
    }

    // Every remaining index is at least this one, and this one is past the last
    // segment, so nothing else can map either.
    if (current >= placed.length) {
      break;
    }

    const segment = placed[current];

    // The index falls in a gap between two segments, which is a row the model
    // does not place.
    if (dataIndex < segment.dataStart) {
      continue;
    }

    displayRows.push(dataStartInDisplay(segment) + (dataIndex - segment.dataStart));
  }

  return displayRows;
}

/**
 * The span of data indices covered by a display range, or null when the range
 * holds no data rows at all (every row in it is a group header, or it sits past
 * the end). Scans segments rather than the range's two edge rows: a viewport can
 * open on a header, close on a header, and still have data rows between them.
 */
export function dataRangeInDisplayRange<TGroup>(
  model: DisplayModel<TGroup>,
  fromDisplay: number,
  toDisplay: number,
): { min: number; max: number } | null {
  const rangeStart = Math.max(0, Math.min(fromDisplay, toDisplay));
  const rangeEnd = Math.max(fromDisplay, toDisplay);

  let min = Infinity;
  let max = -Infinity;

  for (const segment of model.segments) {
    if (segment.collapsed || segment.dataCount === 0) {
      continue;
    }

    const dataStart = dataStartInDisplay(segment);
    const dataEnd = dataStart + segment.dataCount - 1;

    const overlapStart = Math.max(rangeStart, dataStart);
    const overlapEnd = Math.min(rangeEnd, dataEnd);

    if (overlapStart > overlapEnd) {
      continue;
    }

    min = Math.min(min, segment.dataStart + (overlapStart - dataStart));
    max = Math.max(max, segment.dataStart + (overlapEnd - dataStart));
  }

  if (min === Infinity) {
    return null;
  }

  return { min, max };
}
