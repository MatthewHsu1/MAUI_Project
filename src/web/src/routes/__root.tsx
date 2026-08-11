import { createRootRoute, Navigate, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

/**
 * The app shell. Every route renders inside this `<Outlet />`. Unknown URLs
 * fall back to the bonds grid, replacing the bad history entry so Back does
 * not return to it — this is the successor to the old `path="*"` route.
 */
export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => <Navigate to="/bonds" replace />,
});

function RootLayout() {
  return (
    <>
      <Outlet />
      {/* The devtools package is sideEffects-free, so this branch and the
          import are dropped from the production MAUI bundle. */}
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  );
}
