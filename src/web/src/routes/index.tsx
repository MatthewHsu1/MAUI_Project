import { createFileRoute, redirect } from "@tanstack/react-router";

/** There is no landing page; "/" is an alias for the bonds grid. */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/bonds", replace: true });
  },
});
