import { createListenerMiddleware, type Middleware } from "@reduxjs/toolkit";
import type { GridEffect, GridEffectContext } from "./types";
import { columnsPersistenceEffect } from "./columnsPersistenceEffect";

/** All action-driven side-effects a grid runs. Add new effects here. */
export const gridEffects: GridEffect[] = [columnsPersistenceEffect];

/**
 * Build the listener middleware for one grid instance: create the listener
 * middleware and register every gridEffect against this instance's context.
 * Keeps the effect-wiring concern owned by effects/, the way each slice owns
 * its reducer/actions.
 */
export function createEffectsMiddleware<TRow, TGroup>(
  ctx: GridEffectContext<TRow, TGroup>,
): Middleware {
  const listenerMiddleware = createListenerMiddleware();

  for (const effect of gridEffects) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    effect(ctx, listenerMiddleware.startListening as any);
  }

  return listenerMiddleware.middleware;
}
