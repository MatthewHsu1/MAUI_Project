import type { QueryClient } from "@tanstack/react-query";
import { queryClient } from "../../app/queryClient";
import { injectSlice } from "../../app/rootReducer";
import { compareBySpec } from "../dataGrid/data/sortSpec";
import { createGridInstance } from "../dataGrid/store/createGridInstance";
import { localStorageColumnsAdapter } from "../dataGrid/store/localStorageColumnsAdapter";
import type {
  ColumnDef,
  FetchRowsParams,
  GridDescriptor,
  GridSliceState,
  UpdateRowParams,
} from "../dataGrid/types";
import { valuationsQuery } from "./api/bondQueries";
import { bondCells } from "./bondCells";
import type { ConversionValuation } from "./api/types";

/** A valuation as the grid sees it. `symbol` is the stable row key. */
export type BondRow = ConversionValuation;

export const GRID_NAME = "bonds";

/**
 * Adapts the whole-list valuations query onto the grid's slice API: fetch
 * through the cache, sort client-side per the requested sort, serve the slice.
 *
 * The endpoint is not paged, so every slice resolves from one shared
 * whole-list query — `fetchQuery` dedupes them into a single request no matter
 * how many slices the collection asks for. When the API gains offset/limit this
 * becomes a real per-slice request and nothing above it changes.
 *
 * `updateRow` is a no-op — the grid is read-only.
 */
export function createBondGridApi(client: QueryClient) {
  return {
    async fetchRows(p: FetchRowsParams<never>): Promise<BondRow[]> {
      const all = await client.fetchQuery(valuationsQuery());
      const rows = p.sort
        ? [...all].sort((a, b) => compareBySpec(a, b, p.sort!, (r) => r.symbol))
        : all;
      return rows.slice(p.offset, p.offset + p.limit);
    },
    async fetchCount(): Promise<number> {
      const all = await client.fetchQuery(valuationsQuery());
      return all.length;
    },
    async fetchRow(id: string): Promise<BondRow | null> {
      const all = await client.fetchQuery(valuationsQuery());
      return all.find((r) => r.symbol === id) ?? null;
    },
    async updateRow(_p: UpdateRowParams<BondRow, string>): Promise<{ ok: boolean }> {
      return { ok: false };
    },
  };
}

const COLUMN_DEFS: Record<string, ColumnDef> = {
  symbol: { field: "symbol", title: "Symbol", defaultWidth: 110, editable: false, type: "symbol" },
  conversionShares: {
    field: "conversionShares",
    title: "Conversion Shares",
    defaultWidth: 150,
    editable: false,
    type: "shares",
  },
  conversionValue: {
    field: "conversionValue",
    title: "Conversion Value",
    defaultWidth: 160,
    editable: false,
    type: "ntCurrency0",
  },
  stockPrice: {
    field: "stockPrice",
    title: "Stock Price",
    defaultWidth: 130,
    editable: false,
    type: "ntCurrency2",
  },
  bondPrice: {
    field: "bondPrice",
    title: "Bond Price",
    defaultWidth: 130,
    editable: false,
    type: "ntCurrency2",
  },
  isInTheMoney: {
    field: "isInTheMoney",
    title: "Status",
    defaultWidth: 160,
    editable: false,
    type: "status",
  },
  asOf: { field: "asOf", title: "As Of", defaultWidth: 120, editable: false, type: "date" },
};

const columnsAdapter = localStorageColumnsAdapter(`${GRID_NAME}:columns`);

export const bondGridDescriptor: GridDescriptor<BondRow, never, string> = {
  name: GRID_NAME,
  rowKey: (row) => row.symbol,
  columns: {
    defs: COLUMN_DEFS,
    defaultOrder: [
      "symbol",
      "conversionShares",
      "conversionValue",
      "stockPrice",
      "bondPrice",
      "isInTheMoney",
      "asOf",
    ],
    // All columns are read-only; without this the default ("editable only")
    // would make nothing sortable.
    sortable: () => true,
  },
  api: {
    ...createBondGridApi(queryClient),
    loadColumns: columnsAdapter.loadColumns,
    saveColumns: columnsAdapter.saveColumns,
  },
  cells: bondCells,
};

export const bondGrid = createGridInstance(bondGridDescriptor);

// Claim this grid's slot in RootState. Declaring it here rather than in
// app/rootReducer keeps registration with the grid it belongs to, and makes the
// key a literal so no cast is needed to satisfy the reducer map's typing.
declare module "../../app/rootReducer" {
  interface LazyLoadedSlices {
    [GRID_NAME]: GridSliceState<never, string>;
  }
}

injectSlice({ reducerPath: GRID_NAME, reducer: bondGrid.reducer });
