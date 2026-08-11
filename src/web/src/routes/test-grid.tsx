import { createFileRoute } from "@tanstack/react-router";
import { TestGridPage } from "../features/testGrid";

/**
 * The synthetic test grid, at /test-grid.
 *
 * Its data comes from the MSW mock server, which starts only in a development
 * build (src/mocks/browser.ts). A production build has no server behind these
 * requests, so the route says so rather than rendering an empty grid.
 */
export const Route = createFileRoute("/test-grid")({
  component: TestGridRoute,
});

function TestGridRoute() {
  if (!import.meta.env.DEV) {
    return <p style={{ padding: 16 }}>The test grid runs in development builds only.</p>;
  }

  return <TestGridPage />;
}
