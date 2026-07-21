import { startAppListening } from "../../../../app/listener";
import type { GridEffect, GridEffectContext } from "./types";
import { columnsPersistenceEffect } from "./columnsPersistenceEffect";

/** All action-driven side-effects a grid runs. Add new effects here. */
export const gridEffects: GridEffect[] = [columnsPersistenceEffect];

/**
 * Register every gridEffect for one grid instance against the app-wide listener
 * middleware. Keeps the effect-wiring concern owned by effects/, the way each
 * slice owns its reducer/actions.
 *
 * Returns a function that removes this instance's listeners again. The store
 * never needs it — grids live as long as the app — but it keeps tests that
 * build throwaway instances from leaking listeners into later tests.
 */
export function registerEffects<TRow, TGroup>(ctx: GridEffectContext<TRow, TGroup>): () => void {
  const unsubscribers: Array<() => void> = [];

  // GridEffect returns void so one effect may register several listeners; wrap
  // startListening to collect every unsubscribe it hands back.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startListening = (options: any) => {
    const unsubscribe = startAppListening(options);
    unsubscribers.push(unsubscribe);
    return unsubscribe;
  };

  for (const effect of gridEffects) effect(ctx, startListening);

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers.length = 0;
  };
}
