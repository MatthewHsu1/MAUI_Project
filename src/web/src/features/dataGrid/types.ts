import type { Middleware, Reducer } from "@reduxjs/toolkit";
import type { CellRegistry } from "../../lib/grid/cellRegistry";
import type { Boundary } from "./displayModel";

/** Generic column definition. `type` must match a cell registry entry. */
export interface ColumnDef {
  field: string;
  title: string;
  defaultWidth: number;
  editable: boolean;
  type: string;
  withTime?: boolean;
}

export interface FetchWindowParams<TGroup> {
  skip: number;
  take: number;
  collapsedGroups: TGroup[];
  sort?: { field: string; dir: "asc" | "desc" };
}

export interface FetchWindowResult<TRow, TGroup> {
  rows: TRow[];
  total: number;
  precedingGroupKey: TGroup | null;
}

export interface UpdateRowParams {
  id: number;
  field: string;
  value: unknown;
}

/** Optional grouping config. Absent → the grid renders flat (no header rows). */
export interface GridGrouping<TRow, TGroup> {
  field: string;
  of: (row: TRow) => TGroup;
  order: (g: TGroup) => number;
  label: (g: TGroup) => string;
}

export interface GridDescriptor<TRow, TGroup> {
  /** Store namespace + storage-key prefix. Must be a stable, unique string. */
  name: string;
  /** Stable numeric id of a row. */
  rowKey: (row: TRow) => number;
  columns: {
    defs: Record<string, ColumnDef>;
    defaultOrder: string[];
    /** Whether a header click sorts this field. Defaults to "editable columns only". */
    sortable?: (field: string) => boolean;
  };
  grouping?: GridGrouping<TRow, TGroup>;
  api: {
    fetchWindow: (p: FetchWindowParams<TGroup>) => Promise<FetchWindowResult<TRow, TGroup>>;
    updateRow: (p: UpdateRowParams) => Promise<{ ok: boolean }>;
    loadColumns?: () => Promise<ColumnsState | null>;
    saveColumns?: (state: ColumnsState) => Promise<void>;
  };
  cells: CellRegistry;
  /** Row-window page size. Defaults to 100. */
  pageSize?: number;
}

export interface GridDataState<TRow> {
  byIndex: Record<number, TRow>;
  loadingWindows: Record<number, true>;
  total: number;
}

export interface GroupsState<TGroup> {
  boundaries: Boundary<TGroup>[];
  discoveredGroups: TGroup[];
  collapsedGroups: TGroup[];
  sort: { field: string; dir: "asc" | "desc" } | null;
}

export interface ColumnsState {
  order: string[];
  widths: Record<string, number>;
  hidden: string[];
}

export interface SelectionState {
  selectedIds: number[];
}

export interface EditState {
  pending: Record<string, { prev: unknown }>;
  lastError: string | null;
}

export interface GridSliceState<TRow, TGroup> {
  gridData: GridDataState<TRow>;
  groups: GroupsState<TGroup>;
  columns: ColumnsState;
  selection: SelectionState;
  edits: EditState;
}

/**
 * Everything a grid needs at runtime, created once at module scope per grid:
 * the combined reducer (mount under `descriptor.name`), a root selector, all
 * slice action creators, and the two thunks. Hooks and <DataGrid> take this.
 */
export interface GridInstance<TRow, TGroup> {
  descriptor: GridDescriptor<TRow, TGroup>;
  reducer: Reducer<GridSliceState<TRow, TGroup>>;
  selectRoot: (state: unknown) => GridSliceState<TRow, TGroup>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions: Record<string, (...args: any[]) => { type: string; payload?: unknown }>;
  middleware: Middleware;
  thunks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchWindow: (arg: { skip: number; take: number }) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    saveCellEdit: (args: { dataIndex: number; field: string; value: unknown }) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadColumns: () => any;
  };
}
