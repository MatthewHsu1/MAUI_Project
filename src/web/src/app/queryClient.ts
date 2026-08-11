import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../lib/http/ApiError";

/**
 * The app-wide remote-data cache.
 *
 * "Remote data" means data the server owns and this app holds a borrowed copy
 * of. It is stale the moment it arrives, so it needs staleness, refetch and
 * retry semantics that client-owned state (columns, selection, edits — all
 * still in Redux) does not.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Market data: fresh enough to avoid refetch storms while scrolling,
      // short enough that a left-open tab is not showing yesterday's prices.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // A 4xx cannot succeed on retry — the request itself is the problem.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});
