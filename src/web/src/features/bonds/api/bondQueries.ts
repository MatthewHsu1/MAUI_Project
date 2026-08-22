import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "../../../lib/http/apiClient";
import { ApiError } from "../../../lib/http/ApiError";
import type { SortSpec } from "../../dataGrid/data/sortSpec";
import type { ConversionValuation } from "./types";

const PATH = "/api/valuations";

/**
 * The eight filters the slice endpoint and the count endpoint share.
 *
 * Both endpoints read the same filter, because a filter one honours and the
 * other ignores makes the scroll bar disagree with the rows.
 *
 * Every field name is the wire name, so the whole record is spread straight
 * into the query parameters below. That keeps the two lists in step by
 * construction instead of by review.
 */
export interface ValuationFilter {
  /** Prefix match on the bond symbol. Case-sensitive; the symbols are numeric. */
  symbol?: string;

  /** Matches `isInTheMoney` exactly. A row with no value matches neither side. */
  inTheMoney?: boolean;

  /** Inclusive lower bound on `conversionValue`. */
  minConversionValue?: number;

  /** Inclusive upper bound on `conversionValue`. */
  maxConversionValue?: number;

  /** Inclusive lower bound on `bondPrice`. Excludes rows with no price. */
  minBondPrice?: number;

  /** Inclusive upper bound on `bondPrice`. Excludes rows with no price. */
  maxBondPrice?: number;

  /** Inclusive lower bound on `asOf`, as an ISO date (`YYYY-MM-DD`). */
  asOfFrom?: string;

  /** Inclusive upper bound on `asOf`, as an ISO date (`YYYY-MM-DD`). */
  asOfTo?: string;
}

/** One slice of the valuation order: the window, the order, and the filter. */
export interface ValuationsParams {
  /** Index of the first row in the slice. */
  offset: number;

  /** Number of rows in the slice. The server rejects anything outside 1 to 500. */
  limit: number;

  /** Order the server applies before it cuts the slice. Null means the default. */
  sort: SortSpec | null;

  /** Optional restriction. Omitted fields put no restriction on their column. */
  filter?: ValuationFilter;
}

/**
 * Cache keys for bond data. Every key that affects row order belongs here.
 *
 * The count sits under the `valuations` segment so that one prefix
 * invalidation reaches the slices and the total together.
 */
export const bondKeys = {
  all: ["bonds"] as const,
  valuations: (params: ValuationsParams) => [...bondKeys.all, "valuations", params] as const,
  valuationCount: (filter?: ValuationFilter) =>
    [...bondKeys.all, "valuations", "count", filter] as const,
};

/**
 * Requests one ordered slice. Exported separately from the query options so it
 * can be tested without fabricating a TanStack query-function context.
 *
 * The sort and the filter parameters are omitted rather than sent empty when
 * they carry nothing: axios drops an undefined param, and the server treats a
 * missing `sortField` as the default order.
 */
export async function fetchValuations(
  p: ValuationsParams & { signal?: AbortSignal },
): Promise<ConversionValuation[]> {
  const { data } = await apiClient.get<ConversionValuation[]>(PATH, {
    params: {
      offset: p.offset,
      limit: p.limit,
      sortField: p.sort?.field,
      sortDir: p.sort?.direction,
      nulls: p.sort?.nulls,
      ...p.filter,
    },
    signal: p.signal,
  });

  return data;
}

/**
 * The total under the current filter.
 *
 * The endpoint declares no `offset`, `limit`, or sort, because none of them
 * changes a count.
 */
export async function fetchValuationCount(p: {
  filter?: ValuationFilter;
  signal?: AbortSignal;
}): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>(`${PATH}/count`, {
    params: { ...p.filter },
    signal: p.signal,
  });

  return data.count;
}

/**
 * One valuation by symbol, for an id-only refresh of a single row.
 *
 * A 404 is a legitimate answer here — the bond is gone — so it becomes null
 * rather than an exception. Every other failure still throws.
 */
export async function fetchValuation(
  symbol: string,
  signal?: AbortSignal,
): Promise<ConversionValuation | null> {
  try {
    const { data } = await apiClient.get<ConversionValuation>(
      `${PATH}/${encodeURIComponent(symbol)}`,
      { signal },
    );
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

/** One slice of the valuations, cached under the window, the order, and the filter. */
export function valuationsQuery(params: ValuationsParams) {
  return queryOptions({
    queryKey: bondKeys.valuations(params),
    queryFn: ({ signal }) => fetchValuations({ ...params, signal }),
  });
}

/** The filtered total, cached apart from the slices because it changes far less. */
export function valuationCountQuery(filter?: ValuationFilter) {
  return queryOptions({
    queryKey: bondKeys.valuationCount(filter),
    queryFn: ({ signal }) => fetchValuationCount({ filter, signal }),
  });
}
