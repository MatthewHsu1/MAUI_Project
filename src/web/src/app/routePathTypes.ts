import type { NavigateOptions, RegisteredRouter } from "@tanstack/react-router";

/**
 * Compile-time only; nothing imports these values and nothing runs them.
 *
 * They exist so `tsc -b` fails loudly if the `Register` augmentation in
 * router.ts stops taking effect. When that happens `RegisteredRouter` falls
 * back to `AnyRouter`, `to` silently widens to `string`, the `@ts-expect-error`
 * below has nothing to suppress, and TypeScript reports the unused directive.
 */
type AppNavigate = NavigateOptions<RegisteredRouter>;

export const knownPathTypeChecks: AppNavigate = { to: "/bonds" };

// @ts-expect-error unknown route paths must not type-check
export const unknownPathIsRejected: AppNavigate = { to: "/bnods" };
