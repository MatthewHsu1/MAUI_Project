import {
  createGridInstance,
  type ColumnDef,
  type FetchRowsParams,
  type GridDescriptor,
  type GridSliceState,
  type UpdateRowParams,
} from "@matthewhsu1/datagrid";
import { injectSlice } from "../../app/rootReducer";
import { fetchValuation, fetchValuationCount, fetchValuations } from "./api/bondQueries";
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

// Every column names one of the engine's own cell types (the `dg:` prefix) and
// carries that cell's settings on `options`. Nothing is registered and nothing
// is built at module scope — the engine draws all five.
//
// Every bond column is read-only, so no editor ever opens; a null value draws
// as "—".
const COLUMN_DEFS: Record<string, ColumnDef> = {
  symbol: {
    field: "symbol",
    title: "Symbol",
    defaultWidth: 110,
    editable: false,
    type: "dg:text",
  },
  conversionShares: {
    field: "conversionShares",
    title: "Conversion Shares",
    defaultWidth: 150,
    editable: false,
    type: "dg:number",
    options: { format: "integer", thousandSeparator: true },
  },
  conversionValue: {
    field: "conversionValue",
    title: "Conversion Value",
    defaultWidth: 160,
    editable: false,
    type: "dg:number",
    options: { format: "currency", currency: "TWD", decimalScale: 0 },
  },
  stockPrice: {
    field: "stockPrice",
    title: "Stock Price",
    defaultWidth: 130,
    editable: false,
    type: "dg:number",
    options: { format: "currency", currency: "TWD", decimalScale: 2 },
  },
  bondPrice: {
    field: "bondPrice",
    title: "Bond Price",
    defaultWidth: 130,
    editable: false,
    type: "dg:number",
    options: { format: "currency", currency: "TWD", decimalScale: 2 },
  },
  // `isInTheMoney` is a nullable boolean on the wire. The enum cell coerces the
  // raw value with `Number`, so false lands on 0 and true on 1, and null stays
  // null and draws as an empty cell.
  isInTheMoney: {
    field: "isInTheMoney",
    title: "Status",
    defaultWidth: 160,
    editable: false,
    type: "dg:enum",
    options: {
      nullable: true,
      choices: [
        { value: 0, label: "Out of the money", color: "red" },
        { value: 1, label: "In the money", color: "green" },
      ],
    },
  },
  asOf: {
    field: "asOf",
    title: "As Of",
    defaultWidth: 120,
    editable: false,
    type: "dg:date",
    options: { nullable: true },
  },
};

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
  },
  // The engine persists the user's column layout to Web Storage on its own,
  // under `datagrid:bonds:columns`. There is no adapter to hand it.
  api: createBondGridApi(),
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
