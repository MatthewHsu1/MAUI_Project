import { injectSlice } from "../../app/rootReducer";
import { createGridInstance } from "../dataGrid/store/createGridInstance";
import { localStorageColumnsAdapter } from "../dataGrid/store/localStorageColumnsAdapter";
import type {
  ColumnDef,
  FetchWindowParams,
  FetchWindowResult,
  GridDescriptor,
  GridSliceState,
  UpdateRowParams,
} from "../dataGrid/types";
import type { BondDataSource } from "./api/BondDataSource";
import { createBondDataSource } from "./api/createBondDataSource";
import { bondCells } from "./bondCells";
import type { ConversionValuation } from "./types";

/** A bond valuation plus the numeric id the grid uses as its row key. */
export type BondRow = ConversionValuation & { id: number };

export const GRID_NAME = "bonds";

function compareRows(a: BondRow, b: BondRow, field: string, dir: "asc" | "desc"): number {
  const av = (a as unknown as Record<string, unknown>)[field];
  const bv = (b as unknown as Record<string, unknown>)[field];
  const sign = dir === "asc" ? 1 : -1;

  // Nulls sort last, in both directions.
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;

  if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
  return String(av).localeCompare(String(bv)) * sign;
}

/**
 * Adapts the whole-list {@link BondDataSource} onto the grid's windowed API:
 * fetch once (memoized), assign stable numeric ids by source order, sort
 * client-side per the requested sort, and serve the requested slice. `updateRow`
 * is a no-op — the grid is read-only.
 */
export function createBondGridApi(source: BondDataSource) {
  let cache: Promise<BondRow[]> | null = null;

  const load = (): Promise<BondRow[]> => {
    if (!cache) {
      cache = source.getValuations().then((rows) => rows.map((r, i) => ({ ...r, id: i })));
    }
    return cache;
  };

  return {
    async fetchWindow(p: FetchWindowParams<never>): Promise<FetchWindowResult<BondRow, never>> {
      const all = await load();
      const sort = p.sort;
      const rows = sort ? [...all].sort((a, b) => compareRows(a, b, sort.field, sort.dir)) : all;
      return {
        rows: rows.slice(p.skip, p.skip + p.take),
        total: all.length,
        precedingGroupKey: null,
      };
    },
    async updateRow(_p: UpdateRowParams): Promise<{ ok: boolean }> {
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

export const bondGridDescriptor: GridDescriptor<BondRow, never> = {
  name: GRID_NAME,
  rowKey: (row) => row.id,
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
    ...createBondGridApi(createBondDataSource()),
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
    [GRID_NAME]: GridSliceState<BondRow, never>;
  }
}

injectSlice({ reducerPath: GRID_NAME, reducer: bondGrid.reducer });
