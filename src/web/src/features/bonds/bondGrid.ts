import { injectSlice } from "../../app/rootReducer";
import { createGridInstance } from "../dataGrid/store/createGridInstance";
import { localStorageColumnsAdapter } from "../dataGrid/store/localStorageColumnsAdapter";
import type {
  ColumnDef,
  FetchRowsParams,
  GridDescriptor,
  GridSliceState,
  UpdateRowParams,
} from "../dataGrid/types";
import { fetchValuation, fetchValuationCount, fetchValuations } from "./api/bondQueries";
import { bondCells } from "./bondCells";
import type { ConversionValuation } from "./api/types";

/** A valuation as the grid sees it. `symbol` is the stable row key. */
export type BondRow = ConversionValuation;

export const GRID_NAME = "bonds";

/**
 * Adapts the valuations endpoints onto the grid's slice API. The window, the
 * order, and the total all resolve on the server, so this adapter only renames
 * parameters.
 *
 * `updateRow` is a no-op — the grid is read-only.
 */
export function createBondGridApi() {
  return {
    async fetchRows(p: FetchRowsParams<never>): Promise<BondRow[]> {
      return fetchValuations({
        offset: p.offset,
        limit: p.limit,
        sort: p.sort,
        signal: p.signal,
      });
    },
    // The grid's optional count filter is not accepted here on purpose:
    // `FetchRowsParams` carries no filter, so a filtered total would size the
    // scroll bar for rows `fetchRows` never asks for. Both gain it in one step.
    async fetchCount(p: { collapsedGroups: never[]; signal?: AbortSignal }): Promise<number> {
      return fetchValuationCount({ signal: p.signal });
    },
    async fetchRow(id: string, signal?: AbortSignal): Promise<BondRow | null> {
      return fetchValuation(id, signal);
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
    ...createBondGridApi(),
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
