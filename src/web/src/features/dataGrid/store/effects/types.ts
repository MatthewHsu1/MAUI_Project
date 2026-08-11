import type { GridDescriptor, GridSliceState } from "../../types";

/**
 * The per-slice action creators an effect may react to / dispatch. Typed loosely
 * (engine-factory layer), but carrying the `.type` tag RTK attaches to every action
 * creator, so effects can match by action type without unsafe casts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Actions = Record<string, ((...args: any[]) => { type: string }) & { type: string }>;

/**
 * Everything an effect needs to reach one grid: its identity, its descriptor,
 * its state, and its action creators.
 */
export interface GridEffectContext<TRow, TGroup, TKey extends string | number = number> {
  /**
   * Store namespace of this grid. Same value as `descriptor.name`.
   */
  name: string;

  /**
   * The grid's static description, including the server calls.
   */
  descriptor: GridDescriptor<TRow, TGroup, TKey>;

  /**
   * Reads this grid's state out of the app store.
   */
  selectRoot: (s: unknown) => GridSliceState<TGroup, TKey>;

  /**
   * Action creators, one group per slice.
   */
  actions: {
    /**
     * Column order, width, and visibility actions.
     */
    columns: Actions;

    /**
     * Group discovery, collapse, and sort actions.
     */
    groups: Actions;

    /**
     * Row selection actions.
     */
    selection: Actions;

    /**
     * Edit-error actions.
     */
    edits: Actions;
  };
}

/**
 * An effect registers one (or more) listeners via `startListening`, or no-ops
 * (e.g. when its descriptor api hook is absent). Returning void keeps the
 * signature simple and lets one effect add several listeners if needed.
 */
export type GridEffect = <TRow, TGroup, TKey extends string | number>(
  /**
   * The grid the effect attaches to.
   */
  ctx: GridEffectContext<TRow, TGroup, TKey>,

  /**
   * RTK's listener registration function. Its real type is heavily generic, so
   * we type it `any` here (engine factory layer — localized `any` is already
   * sanctioned). Effects themselves stay readable. Keep the `any` in effects/.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  startListening: any,
) => void;
