import type { Reducer } from "@reduxjs/toolkit";
import type { CellRegistry } from "../../lib/grid/cellRegistry";
import type { RowStore } from "./data/rowStore";
import type { SortSpec } from "./data/sortSpec";

/**
 * Generic column definition.
 */
export interface ColumnDef {
  /**
   * Row property this column reads. Also the column's id in every state slice.
   */
  field: string;

  /**
   * Header text.
   */
  title: string;

  /**
   * Width in pixels before the user resizes the column.
   */
  defaultWidth: number;

  /**
   * Whether a cell in this column accepts an edit.
   */
  editable: boolean;

  /**
   * Cell kind. Must match a cell registry entry.
   */
  type: string;

  /**
   * Date cells only: keep the time part instead of a floating calendar date.
   */
  withTime?: boolean;
}

/**
 * A single-column ordering. `null` anywhere this appears means natural order.
 */
export interface GridSort {
  /**
   * Field to order by.
   */
  field: string;

  /**
   * Direction of the ordering.
   */
  dir: "asc" | "desc";
}

/**
 * A subset request. The loader asks for a slice of an order, not for a numbered
 * page.
 */
export interface FetchRowsParams<TGroup> {
  /**
   * Index of the first row in the slice.
   */
  offset: number;

  /**
   * Number of rows in the slice.
   */
  limit: number;

  /**
   * Order the server applies before it cuts the slice.
   */
  sort: SortSpec | null;

  /**
   * Groups the server must exclude, because the user collapsed them.
   */
  collapsedGroups: TGroup[];

  /**
   * Cancels the request when the grid drops the slice.
   */
  signal?: AbortSignal;
}

/**
 * A cross-client change notification. It names the row, never carries it.
 */
export interface RowChange<TKey extends string | number = number> {
  /**
   * What happened to the row.
   */
  kind: "create" | "update" | "delete";

  /**
   * Stable key of the changed row.
   */
  id: TKey;

  /**
   * Monotonic per connection. A gap means the client missed a message and must
   * resync.
   */
  sequence: number;
}

/**
 * A single cell edit, addressed by row key.
 */
export interface UpdateRowParams<TRow, TKey extends string | number = number> {
  /**
   * Stable key of the row to edit.
   */
  id: TKey;

  /**
   * Changed fields only.
   */
  changes: Partial<TRow>;
}

/**
 * Optional grouping config. Absent → the grid renders flat (no header rows).
 */
export interface GridGrouping<TRow, TGroup> {
  /**
   * Field the grouping reads. Header rows report it.
   */
  field: string;

  /**
   * Extracts a row's group key.
   *
   * `TGroup` MUST be a primitive (string, number, or boolean) or an otherwise
   * stably-interned value. The engine tracks discovered/collapsed groups with
   * `===`, `Array.includes`, and `Set`, i.e. it compares groups by identity — so
   * if `of` returns a fresh object per call (e.g. `{ year, month }`), every row
   * reads as a new group and collapse + dedup both silently no-op. Derive a
   * primitive key instead (e.g. `` `${year}-${month}` ``).
   */
  of: (row: TRow) => TGroup;

  /**
   * Sort weight of a group. The grid orders header rows by this number.
   *
   * It MUST agree with the ascending order of `field`: group X sorts before
   * group Y here exactly when `X.field < Y.field`. The client live query orders
   * rows by `field` as a plain property reference — the only expression the
   * query builder accepts — while the header rows are placed by this function.
   * If the two disagree, the headers and the rows under them describe different
   * orders.
   *
   * The simple way to satisfy this is to keep the group values in a sorted
   * array and return `SORTED.indexOf(g)`.
   */
  order: (g: TGroup) => number;

  /**
   * Header text for a group.
   */
  label: (g: TGroup) => string;
}

/**
 * The static description of one grid: its identity, columns, grouping, server
 * calls, and cell renderers.
 */
export interface GridDescriptor<TRow, TGroup, TKey extends string | number = number> {
  /**
   * Store namespace + storage-key prefix. Must be a stable, unique string.
   */
  name: string;

  /**
   * Stable identity of a row. Must not be derived from array position.
   */
  rowKey: (row: TRow) => TKey;

  /**
   * Column set and its default presentation.
   */
  columns: {
    /**
     * All columns, keyed by field.
     */
    defs: Record<string, ColumnDef>;

    /**
     * Left-to-right field order before the user reorders the columns.
     */
    defaultOrder: string[];

    /**
     * Whether a header click sorts this field. Defaults to "editable columns only".
     */
    sortable?: (field: string) => boolean;
  };

  /**
   * Group config. Omit it to render a flat list.
   */
  grouping?: GridGrouping<TRow, TGroup>;

  /**
   * Every server call the grid makes.
   */
  api: {
    /**
     * Loads one ordered slice. `hooks/useRowPages.ts` calls this, never a
     * component.
     *
     * A descriptor with `grouping` MUST have its server order every request by
     * `grouping.field` ascending FIRST, then by `sort` second. The group order
     * never appears in this request: `p.sort` carries only the user's column,
     * so the server applies the group prefix itself, on every call, whether or
     * not it is named here (see `GridGrouping.order` for the matching
     * client-side rule). A server that ignores this returns the wrong rows for
     * the window, and the client cannot repair that: it can only re-order the
     * rows the window already holds, not fetch the rows it should have held.
     */
    fetchRows: (p: FetchRowsParams<TGroup>) => Promise<TRow[]>;

    /**
     * Total rows under the current view. A live query returns no total.
     *
     * `filter` is opaque here: the descriptor's own implementation knows its
     * shape, and the grid only carries it. It belongs in the count's query key,
     * because a filter change changes the total, and a stale total sizes the
     * scroll bar for rows the grid never receives.
     */
    fetchCount: (p: {
      collapsedGroups: TGroup[];
      filter?: unknown;
      signal?: AbortSignal;
    }) => Promise<number>;

    /**
     * One row by id, for an id-only push notification.
     */
    fetchRow: (id: TKey, signal?: AbortSignal) => Promise<TRow | null>;

    /**
     * Optional live change feed. Returns an unsubscribe function. The grid
     * owns no transport: SignalR, WebSocket, or polling all fit here.
     */
    subscribe?: (handler: (change: RowChange<TKey>) => void) => () => void;

    /**
     * Persist a single cell edit. On success may return the server's
     * authoritative `row` (including derived columns), which
     * `hooks/useCellRenderer.ts` writes into the row store over the optimistic
     * value. `{ ok: false }` signals a rejected/read-only edit and triggers a
     * rollback.
     */
    updateRow: (p: UpdateRowParams<TRow, TKey>) => Promise<{ ok: boolean; row?: TRow }>;

    /**
     * Reads the user's saved column layout. Omit it to always start from the
     * defaults.
     */
    loadColumns?: () => Promise<ColumnsState | null>;

    /**
     * Persists the user's column layout.
     */
    saveColumns?: (state: ColumnsState) => Promise<void>;
  };

  /**
   * Cell renderers and editors, looked up by `ColumnDef.type`.
   */
  cells: CellRegistry;

  /**
   * Row-window page size. Defaults to 100.
   */
  pageSize?: number;
}

/**
 * Client-owned grouping state.
 *
 * Boundaries are NOT here: they are a pure function of the currently loaded
 * windows and are derived in `useDisplayModel`. Storing them meant they could
 * outlive the rows they described.
 */
export interface GroupsState<TGroup> {
  /**
   * Monotonic memory of groups the user has seen. It stays here because a
   * collapsed group's rows are excluded by the server, so this list cannot be
   * re-derived from the loaded rows.
   */
  discoveredGroups: TGroup[];

  /**
   * Groups the user collapsed. The grid sends them to every server call.
   */
  collapsedGroups: TGroup[];

  /**
   * Current header-click ordering.
   */
  sort: GridSort | null;
}

/**
 * Client-owned column layout. It is the only part of the presentation the user
 * changes directly.
 */
export interface ColumnsState {
  /**
   * Left-to-right field order.
   */
  order: string[];

  /**
   * Pixel width per field, for fields the user resized.
   */
  widths: Record<string, number>;

  /**
   * Fields the user hid.
   */
  hidden: string[];
}

/**
 * Client-owned row selection.
 */
export interface SelectionState<TKey extends string | number = number> {
  /**
   * Stable keys of the selected rows.
   */
  selectedIds: TKey[];
}

/**
 * A rejected save: the message shown, and the cell it belongs to.
 */
export interface EditError {
  /**
   * `${rowKey}:${field}` — the row's stable key, never its position, so it
   * still names the same cell after a reload moves the row. It exists so a
   * success can clear an error only when the success is about the SAME cell; a
   * save that landed on one cell says nothing about a save that failed on
   * another.
   */
  cell: string;

  /**
   * Text the banner shows.
   */
  message: string;
}

/**
 * The edit slice holds only what the UI cannot derive from the rows themselves.
 * "This cell is not saved yet" is NOT here: `data/editOverlay.ts` holds the
 * in-flight value and `useCellRenderer` reads its `isPending`. What survives is
 * the last rejection, which no row carries.
 */
export interface EditState {
  /**
   * One error, not a map. The banner shows one message, so the state holds one;
   * the cell on it is the minimum needed to decide whether a later success
   * retracts that message, and is deliberately not a per-cell `pending` map —
   * the overlay already answers that question.
   */
  lastError: EditError | null;
}

/**
 * All client-owned state of one grid, mounted under `descriptor.name`.
 */
export interface GridSliceState<TGroup, TKey extends string | number = number> {
  /**
   * Discovered groups, collapse state, and sort.
   */
  groups: GroupsState<TGroup>;

  /**
   * Column order, widths, and hidden fields.
   */
  columns: ColumnsState;

  /**
   * Selected row keys.
   */
  selection: SelectionState<TKey>;

  /**
   * Last rejected save.
   */
  edits: EditState;
}

/**
 * Everything a grid needs at runtime, created once at module scope per grid:
 * the combined reducer (mount under `descriptor.name`) for client-owned state,
 * a root selector, all slice action creators, the thunks, and the cell that
 * holds the mounted grid's row store. Hooks and <DataGrid> take this.
 */
export interface GridInstance<TRow extends object, TGroup, TKey extends string | number = number> {
  /**
   * The descriptor this instance was built from.
   */
  descriptor: GridDescriptor<TRow, TGroup, TKey>;

  /**
   * Combined reducer for the client-owned state. Mount it under
   * `descriptor.name`.
   */
  reducer: Reducer<GridSliceState<TGroup, TKey>>;

  /**
   * Reads this grid's state out of the app store.
   */
  selectRoot: (state: unknown) => GridSliceState<TGroup, TKey>;

  /**
   * Action creators of every slice, keyed by name.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions: Record<string, (...args: any[]) => { type: string; payload?: unknown }>;

  /**
   * A stable cell holding the row store the grid is DRAWING, republished by
   * `useGridData` on every render and again the moment a hold adopts.
   *
   * It is a cell rather than a value because `data/sync/useRowSync.ts`
   * subscribes once, for the life of the grid, and must reach whichever store
   * the mounted grid owns without re-subscribing. It is null until a grid
   * mounts; a push that arrives before then has nothing to write to and is
   * correctly dropped.
   *
   * It does NOT go back to null on unmount. Nothing clears it, so it keeps the
   * store of the grid that mounted last, and that store is then reachable with
   * no grid drawing it. Nothing writes through it in that state — `useRowSync`
   * unsubscribes with the grid, and it is the only writer — and the next mount
   * overwrites the cell on its first render.
   *
   * ONE MOUNTED GRID PER INSTANCE. This cell, `pendingStoreRef`, and
   * `carryFromRef` are single slots on one module-scope object, so two grids
   * mounted on the same instance at the same time overwrite each other: a push
   * would land on whichever store rendered last, and a collapse boundary
   * measured by one grid would be consumed by the other. A second view of the
   * same rows needs a second `createGridInstance`.
   */
  storeRef: { current: RowStore<TRow, TKey> | null };

  /**
   * The store of the view loading BEHIND the screen during a hold, or null when
   * no hold is open.
   *
   * A hold runs two stores at once, and adoption puts this one on screen. A
   * push that maintained `storeRef` alone would therefore write the row the
   * user is about to stop reading and miss the row the user is about to start
   * reading, so `data/sync/useRowSync.ts` patches both. It is a second cell
   * rather than a list because the two have different jobs, and the hook must
   * be able to tell them apart: only the DISPLAYED store's indexes may reach
   * the grid's damage callback.
   *
   * `useGridData` writes it on every render and clears it at adoption, so it
   * reads null whenever no hold is open. Unmount is the exception, exactly as
   * it is for `storeRef`: nothing clears it there, so a grid unmounted mid-hold
   * leaves the pending store here until the next mount's first render replaces
   * it. The one-mounted-grid rule above covers this cell too.
   */
  pendingStoreRef: { current: RowStore<TRow, TKey> | null };

  /**
   * The first data index the next collapse change moves, written by the header
   * click and read once by `useGridData`. Null means "everything moves", which
   * is the state a sort leaves it in.
   *
   * A cell rather than an action payload because only the display model knows
   * where a group starts, and only the click handler holds that model. The rows
   * ABOVE this index keep the index they already have, so the new view starts
   * with those pages already loaded instead of asking for them again.
   */
  carryFromRef: { current: number | null };

  /**
   * Subscribes to invalidations of every loaded row. A push that creates or
   * deletes a row moves every position after it, which no page-indexed cache
   * can repair in place.
   */
  subscribeDataGeneration: (listener: () => void) => () => void;

  /**
   * The current invalidation count. Part of the row store's identity, beside
   * the sort and the collapse set.
   */
  getDataGeneration: () => number;

  /**
   * Invalidates every loaded row. Called by the push subscriber
   * (`data/sync/useRowSync.ts`) and by the mock reset bar.
   */
  bumpDataGeneration: () => void;

  /**
   * Removes this instance's effects from the shared grid listener.
   */
  stopEffects: () => void;

  /**
   * Async actions that need the descriptor.
   */
  thunks: {
    /**
     * Restores the saved column layout through `api.loadColumns`.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadColumns: () => any;
  };
}
