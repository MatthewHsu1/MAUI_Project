import type { GridDescriptor, GridSliceState } from "../../types";

// The per-slice action creators an effect may react to / dispatch. Typed loosely
// (engine-factory layer), but carrying the `.type` tag RTK attaches to every action
// creator, so effects can match by action type without unsafe casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Actions = Record<string, ((...args: any[]) => { type: string }) & { type: string }>;

export interface GridEffectContext<TRow, TGroup> {
  name: string;
  descriptor: GridDescriptor<TRow, TGroup>;
  selectRoot: (s: unknown) => GridSliceState<TRow, TGroup>;
  actions: {
    columns: Actions;
    gridData: Actions;
    groups: Actions;
    selection: Actions;
    edits: Actions;
  };
}

// An effect registers one (or more) listeners via `startListening`, or no-ops
// (e.g. when its descriptor api hook is absent). Returning void keeps the
// signature simple and lets one effect add several listeners if needed.
// `startListening` is RTK's listener registration fn; its real type is heavily
// generic, so we type it `any` here (engine factory layer — localized `any` is
// already sanctioned). Effects themselves stay readable. Keep the `any` in effects/.
export type GridEffect = <TRow, TGroup>(
  ctx: GridEffectContext<TRow, TGroup>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  startListening: any,
) => void;
