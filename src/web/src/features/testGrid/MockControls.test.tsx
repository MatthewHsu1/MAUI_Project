import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockControls } from "./MockControls";
import { mockConfig, setMockConfig } from "./mocks/mockConfig";

// Spread the real module rather than returning a bare `{ resetTestRows }`.
// `MockControls` imports `GRID_NAME` from `./testGrid`, whose descriptor
// dereferences the four OTHER exports of this module at module-evaluation time.
// Vitest 4 throws `No "fetchTestRows" export is defined on the mock` on that
// dereference — before any test body runs — if the factory omits them.
vi.mock("./api/testRowQueries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api/testRowQueries")>()),
  resetTestRows: vi.fn().mockResolvedValue(100000),
}));

function renderControls() {
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <MockControls />
    </QueryClientProvider>,
  );

  return { queryClient };
}

beforeEach(() => {
  setMockConfig({ latencyMs: 150, failureRate: 0 });
  vi.clearAllMocks();
});

describe("MockControls", () => {
  it("writes the chosen latency to the mock config", async () => {
    renderControls();

    await userEvent.selectOptions(screen.getByLabelText("Latency"), "800");

    expect(mockConfig.latencyMs).toBe(800);
  });

  it("writes the chosen failure rate to the mock config", async () => {
    renderControls();

    await userEvent.selectOptions(screen.getByLabelText("Failures"), "0.5");

    expect(mockConfig.failureRate).toBe(0.5);
  });

  it("calls the reset endpoint", async () => {
    const { resetTestRows } = await import("./api/testRowQueries");
    renderControls();

    await userEvent.click(screen.getByRole("button", { name: "Reset data" }));

    expect(resetTestRows).toHaveBeenCalled();
  });

  // The cache keys are the part of this component that is easy to get wrong, so
  // seed both caches and prove the click empties them. Asserting only that the
  // spy fired would stay green under a mistyped key.
  it("drops the cached row slices and the cached count", async () => {
    const { queryClient } = renderControls();

    // The shape `rowPagesKey` builds: the prefix, the page number, the sort,
    // and the collapse set.
    const pageKey = ["testGrid", "page", 0, null, []];

    queryClient.setQueryData(pageKey, [{ id: 1 }]);
    queryClient.setQueryData(["testGrid", "count", []], 100000);

    await userEvent.click(screen.getByRole("button", { name: "Reset data" }));

    await waitFor(() => {
      expect(queryClient.getQueryData(pageKey)).toBeUndefined();
    });
    expect(queryClient.getQueryData(["testGrid", "count", []])).toBeUndefined();
  });

  it("shows a message when the reset request fails", async () => {
    const { resetTestRows } = await import("./api/testRowQueries");
    vi.mocked(resetTestRows).mockRejectedValueOnce(new Error("Injected mock failure"));

    renderControls();

    await userEvent.click(screen.getByRole("button", { name: "Reset data" }));

    expect(await screen.findByText("Injected mock failure")).toBeInTheDocument();
  });
});
