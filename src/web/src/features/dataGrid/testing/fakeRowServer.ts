import { compareBySpec } from "../data/sortSpec";
import type { FetchRowsParams, RowChange } from "../types";

interface Config<TRow, TGroup, TKey extends string | number> {
  rows: TRow[];
  rowKey: (row: TRow) => TKey;
  /**
   * A row's group. Supply it and the server hides a collapsed group's rows from
   * BOTH `fetchRows` and `fetchCount`, which is what a real server does. Omit
   * it and collapse state is ignored, as it is for a grid with no grouping.
   */
  groupOf?: (row: TRow) => TGroup;
}

/**
 * The server every data-layer test runs against.
 *
 * It sorts with `compareBySpec`, the same function the live query uses. That is
 * the point: if the two ever disagree, a test fails instead of a user seeing
 * rows jump.
 */
export function createFakeRowServer<TRow, TGroup, TKey extends string | number>(
  config: Config<TRow, TGroup, TKey>,
) {
  let rows = [...config.rows];
  let sequence = 0;
  const handlers = new Set<(change: RowChange<TKey>) => void>();

  const visible = (collapsedGroups: TGroup[] | undefined): TRow[] => {
    const groupOf = config.groupOf;
    if (!groupOf || !collapsedGroups || collapsedGroups.length === 0) return [...rows];
    return rows.filter((r) => !collapsedGroups.includes(groupOf(r)));
  };

  const ordered = (p: FetchRowsParams<TGroup>): TRow[] => {
    const subject = visible(p.collapsedGroups);
    const sort = p.sort;
    if (!sort) return subject;
    return subject.sort((a, b) => compareBySpec(a, b, sort, config.rowKey));
  };

  const api = {
    fetchRows: async (p: FetchRowsParams<TGroup>): Promise<TRow[]> =>
      ordered(p).slice(p.offset, p.offset + p.limit),

    fetchCount: async (p: { collapsedGroups: TGroup[]; signal?: AbortSignal }): Promise<number> =>
      visible(p.collapsedGroups).length,

    fetchRow: async (id: TKey): Promise<TRow | null> =>
      rows.find((r) => config.rowKey(r) === id) ?? null,

    updateRow: async ({
      id,
      changes,
    }: {
      id: TKey;
      changes: Partial<TRow>;
    }): Promise<{ ok: boolean; row?: TRow }> => {
      const index = rows.findIndex((r) => config.rowKey(r) === id);
      if (index < 0) return { ok: false };
      const next = { ...rows[index], ...changes };
      rows = [...rows.slice(0, index), next, ...rows.slice(index + 1)];
      return { ok: true, row: next };
    },

    subscribe: (handler: (change: RowChange<TKey>) => void) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };

  return {
    api,
    /** Emits a change to every subscriber, stamping the next sequence number. */
    push(change: Omit<RowChange<TKey>, "sequence">) {
      sequence += 1;
      const full = { ...change, sequence };
      for (const h of handlers) h(full);
    },
    /** Mutates the server's rows directly, for arrange steps in tests. */
    setRows(next: TRow[]) {
      rows = [...next];
    },
    get rows() {
      return rows;
    },
  };
}
