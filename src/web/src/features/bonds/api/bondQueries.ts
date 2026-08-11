import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "../../../lib/http/apiClient";
import type { ConversionValuation } from "./types";

/** Cache keys for bond data. Every key that affects row order belongs here. */
export const bondKeys = {
  all: ["bonds"] as const,
  valuations: () => [...bondKeys.all, "valuations"] as const,
};

/**
 * Requests all current valuations. Exported separately from the query options so
 * it can be tested without fabricating a TanStack query-function context.
 */
export async function fetchValuations(signal?: AbortSignal): Promise<ConversionValuation[]> {
  const { data } = await apiClient.get<ConversionValuation[]>("/api/valuations", { signal });
  return data;
}

/**
 * All current valuations.
 *
 * The endpoint is not yet paged, so this fetches the whole collection and the
 * grid windows over it client-side. When the API gains offset/limit/sort, this
 * becomes a per-page query and the key gains those parameters.
 */
export function valuationsQuery() {
  return queryOptions({
    queryKey: bondKeys.valuations(),
    queryFn: ({ signal }) => fetchValuations(signal),
  });
}
