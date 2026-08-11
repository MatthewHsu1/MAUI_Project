import { delay, http, HttpResponse, type RequestHandler } from "msw";
import type { SortSpec } from "../../dataGrid/data/sortSpec";
import type { TestRow } from "../api/types";
import { mockConfig } from "./mockConfig";
import { testRowStore } from "./testRowStore";

/**
 * Paths are matched with a leading wildcard rather than against
 * `VITE_API_BASE_URL`.
 *
 * The base URL differs between the dev server and a test run, and reading it
 * here would tie the handlers to an environment variable that Vitest does not
 * load. A wildcard matches whatever origin `apiClient` resolves.
 */
const ROWS = "*/api/test-rows";

/**
 * Waits, then decides whether this request fails.
 *
 * Returns the 500 response to send, or null to carry on. Every handler starts
 * with it, so latency and failure injection are described once.
 */
async function gate(): Promise<Response | null> {
  await delay(mockConfig.latencyMs);

  if (mockConfig.failureRate > 0 && Math.random() < mockConfig.failureRate) {
    return HttpResponse.json({ message: "Injected mock failure" }, { status: 500 });
  }

  return null;
}

/** The collapsed sectors, as a comma-separated query parameter. */
function readCollapsed(url: URL): string[] {
  return (url.searchParams.get("collapsed") ?? "").split(",").filter(Boolean);
}

/** The column sort, or null when the request names no sort field. */
function readSort(url: URL): SortSpec | null {
  const field = url.searchParams.get("sortField");

  if (!field) {
    return null;
  }

  return {
    field,
    direction: url.searchParams.get("sortDir") === "desc" ? "desc" : "asc",
    nulls: url.searchParams.get("nulls") === "first" ? "first" : "last",
  };
}

/**
 * The development server for the test grid.
 *
 * ORDER MATTERS. MSW matches handlers in registration order, so the two literal
 * paths must precede `:id`, or `:id` swallows "count" and "reset".
 */
export const testGridHandlers: RequestHandler[] = [
  http.get(`${ROWS}/count`, async ({ request }) => {
    const failure = await gate();

    if (failure) {
      return failure;
    }

    const url = new URL(request.url);

    return HttpResponse.json({ count: testRowStore.count(readCollapsed(url)) });
  }),

  http.post(`${ROWS}/reset`, async () => {
    const failure = await gate();

    if (failure) {
      return failure;
    }

    return HttpResponse.json({ count: testRowStore.reset() });
  }),

  http.get(`${ROWS}/:id`, async ({ params }) => {
    const failure = await gate();

    if (failure) {
      return failure;
    }

    const row = testRowStore.find(Number(params.id));

    if (!row) {
      return HttpResponse.json({ message: "No such row" }, { status: 404 });
    }

    return HttpResponse.json(row);
  }),

  http.patch(`${ROWS}/:id`, async ({ params, request }) => {
    const failure = await gate();

    if (failure) {
      return failure;
    }

    const changes = (await request.json()) as Partial<TestRow>;
    const row = testRowStore.update(Number(params.id), changes);

    if (!row) {
      return HttpResponse.json({ message: "No such row" }, { status: 404 });
    }

    return HttpResponse.json(row);
  }),

  http.get(ROWS, async ({ request }) => {
    const failure = await gate();

    if (failure) {
      return failure;
    }

    const url = new URL(request.url);

    const rows = testRowStore.slice({
      offset: Number(url.searchParams.get("offset") ?? 0),
      limit: Number(url.searchParams.get("limit") ?? 100),
      sort: readSort(url),
      collapsed: readCollapsed(url),
    });

    return HttpResponse.json(rows);
  }),
];
