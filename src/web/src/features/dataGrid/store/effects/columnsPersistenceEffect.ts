import type { GridEffect } from "./types";

const SAVE_DEBOUNCE_MS = 500;

/** Persist column layout via descriptor.api.saveColumns, debounced. No-ops when
 *  the grid declares no saveColumns. */
export const columnsPersistenceEffect: GridEffect = (ctx, startListening) => {
  const save = ctx.descriptor.api.saveColumns;

  if (!save) return;

  const { moveColumn, resizeColumn, toggleColumn } = ctx.actions.columns;
  const watched = [moveColumn.type, resizeColumn.type, toggleColumn.type];

  startListening({
    predicate: (action: { type: string }) => watched.includes(action.type),
    effect: async (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _action: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api: any,
    ) => {
      api.cancelActiveListeners(); // debounce: cancel any queued save
      await api.delay(SAVE_DEBOUNCE_MS); // resolves only if not superseded
      await save(ctx.selectRoot(api.getState()).columns);
    },
  });
};
