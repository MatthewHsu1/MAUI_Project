import { setupWorker } from "msw/browser";
import { testGridHandlers } from "../features/testGrid/mocks/handlers";

/**
 * Starts the development mock server.
 *
 * Only `src/main.tsx` calls this, from inside an `import.meta.env.DEV` branch
 * and through a dynamic `import()`. That branch is what keeps the 100,000-row
 * generator, the store, and MSW itself out of the production MAUI bundle:
 * nothing the page imports directly reaches this module.
 *
 * `onUnhandledRequest: "bypass"` is mandatory. The worker sees EVERY request the
 * page makes, and the app's own dev token request in `main.tsx` goes to the real
 * API. Anything but "bypass" breaks it.
 */
export async function startMocks(): Promise<void> {
  const worker = setupWorker(...testGridHandlers);

  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
}
