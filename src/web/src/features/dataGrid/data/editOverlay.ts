export interface EditOverlay<TRow extends object, TKey extends string | number> {
  /** Records an optimistic value for one cell. */
  begin: (key: TKey, field: string, value: unknown) => void;

  /** The save landed. The store holds the value now, so the overlay lets it go. */
  commit: (key: TKey, field: string) => void;

  /** The save was rejected. Dropping the entry restores the stored row. */
  rollback: (key: TKey, field: string) => void;

  /** The stored row with any in-flight values of that row laid over it. */
  apply: (key: TKey, row: TRow) => TRow;

  /** Whether any cell of this row has a save in flight. */
  isPending: (key: TKey) => boolean;

  /** Every row key with a save in flight. */
  pendingKeys: () => TKey[];

  clear: () => void;
}

/**
 * Where an optimistic edit lives until the server answers.
 *
 * The point of a separate structure is the rollback. `data/rowStore.ts` holds
 * only what the server sent, so a rejected save needs no saved copy and no
 * restore — deleting the overlay entry IS the rollback, and it is correct even
 * when a reload replaced the underlying row in between.
 *
 * It also replaces the virtual `synced` flag the previous row layer stamped on
 * an optimistic row. `isPending` is the same signal, from a structure this
 * codebase owns.
 *
 * Both `commit` and `rollback` delete the entry. They differ only in what the
 * caller does to the store first, and they stay two functions because the call
 * sites read as two different intentions.
 */
export function createEditOverlay<TRow extends object, TKey extends string | number>(): EditOverlay<
  TRow,
  TKey
> {
  const pendingByKey = new Map<TKey, Map<string, unknown>>();

  const settle = (key: TKey, field: string) => {
    const fields = pendingByKey.get(key);

    if (fields === undefined) {
      return;
    }

    fields.delete(field);

    // The key goes when its last field settles, so `pendingKeys` never reports
    // a row that has nothing in flight and the map cannot grow without bound
    // over a long editing session.
    if (fields.size === 0) {
      pendingByKey.delete(key);
    }
  };

  return {
    begin(key, field, value) {
      const fields = pendingByKey.get(key) ?? new Map<string, unknown>();

      fields.set(field, value);
      pendingByKey.set(key, fields);
    },

    commit: settle,
    rollback: settle,

    apply(key, row) {
      const fields = pendingByKey.get(key);

      // The SAME object when nothing is pending, not a copy. `getCellContent`
      // runs this once per visible cell per paint, and a fresh object per call
      // would defeat every identity check downstream of it.
      if (fields === undefined || fields.size === 0) {
        return row;
      }

      const merged: Record<string, unknown> = { ...(row as Record<string, unknown>) };

      for (const [field, value] of fields) {
        merged[field] = value;
      }

      return merged as TRow;
    },

    isPending(key) {
      const fields = pendingByKey.get(key);

      return fields !== undefined && fields.size > 0;
    },

    pendingKeys() {
      return [...pendingByKey.keys()];
    },

    clear() {
      pendingByKey.clear();
    },
  };
}
