import type { ColumnsState } from "../types";

/**
 * Builds `loadColumns`/`saveColumns` backed by Web Storage. This is the home of
 * localStorage knowledge — the slice and engine never touch it directly. A future
 * grid can supply a REST-backed adapter with the same shape (descriptor.api.*).
 */
export function localStorageColumnsAdapter(
  storageKey: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): {
  loadColumns: () => Promise<ColumnsState | null>;
  saveColumns: (s: ColumnsState) => Promise<void>;
} {
  return {
    async loadColumns() {
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<ColumnsState>;
        // Only hydrate fields that are present & well-formed; missing → caller keeps defaults.
        if (!parsed || typeof parsed !== "object") return null;
        return {
          order: Array.isArray(parsed.order) && parsed.order.length ? parsed.order : [],
          widths: parsed.widths ?? {},
          hidden: parsed.hidden ?? [],
        };
      } catch {
        return null;
      }
    },
    async saveColumns(state) {
      try {
        storage.setItem(storageKey, JSON.stringify(state));
      } catch {
        /* ignore quota/unavailable */
      }
    },
  };
}
