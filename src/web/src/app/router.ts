import { createHashHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "../routeTree.gen";

/**
 * Hash history is required: the MAUI HybridWebView serves this bundle from a
 * virtual root, so path-based URLs never reach the app. Same reason
 * vite.config.ts sets `base: "./"`.
 */
export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

/**
 * Registers this router as *the* app router. Without this, `to` on `Link`,
 * `useNavigate`, and `redirect` degrades to plain `string` and the migration
 * buys nothing. `routePathTypes.ts` fails the build if that happens.
 */
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
