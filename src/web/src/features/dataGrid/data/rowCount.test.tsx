import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { GridDescriptor } from "../types";
import { rowCountKey, useRowCount } from "./rowCount";

interface Row {
  id: number;
}

function harness(count = 42, fetchCountImpl?: () => Promise<number>) {
  const fetchCount = vi.fn(fetchCountImpl ?? (async () => count));
  const descriptor = {
    name: "demo",
    rowKey: (r: Row) => r.id,
    api: { fetchCount },
  } as unknown as GridDescriptor<Row, number, number>;

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { descriptor, fetchCount, queryClient, wrapper };
}

describe("useRowCount", () => {
  it("reports 0 before the count arrives, then the server count", async () => {
    const { descriptor, wrapper } = harness(42);
    const { result } = renderHook(() => useRowCount(descriptor, []), { wrapper });

    expect(result.current.total).toBe(0);
    await waitFor(() => expect(result.current.total).toBe(42));
  });

  it("reports the count as unsettled until the one for this key lands", async () => {
    const { descriptor, wrapper } = harness(42);

    const { result } = renderHook(() => useRowCount(descriptor, []), { wrapper });

    // A total of 0 means "not back yet" here, and the hold in `useGridData`
    // must be able to tell that from a table that really holds no rows.
    expect(result.current.settled).toBe(false);

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.total).toBe(42);
  });

  it("counts a rejected request as settled, so a hold cannot run for ever", async () => {
    const { descriptor, wrapper } = harness(42, async () => {
      throw new Error("boom");
    });

    const { result } = renderHook(() => useRowCount(descriptor, []), { wrapper });

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.total).toBe(0);
  });

  it("asks again when the collapsed groups change", async () => {
    const { descriptor, fetchCount, wrapper } = harness();
    const { rerender } = renderHook(({ groups }) => useRowCount(descriptor, groups), {
      wrapper,
      initialProps: { groups: [] as number[] },
    });

    await waitFor(() => expect(fetchCount).toHaveBeenCalledTimes(1));
    rerender({ groups: [1] });
    await waitFor(() => expect(fetchCount).toHaveBeenCalledTimes(2));
  });
});

describe("rowCountKey", () => {
  it("keys the same groups alike whatever order they arrive in", () => {
    expect(rowCountKey("demo", [2, 1])).toEqual(rowCountKey("demo", [1, 2]));
  });
});
