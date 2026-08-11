import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { rowsKeyPrefix } from "../../hooks/useRowPages";
import type { GridDescriptor, RowChange } from "../../types";
import { rowCountKey } from "../rowCount";
import type { RowStore } from "../rowStore";
import { planPushes, type PushPlan } from "./planPushes";

/** How long changes collect before the grid acts on them. */
export const PUSH_BUFFER_MS = 200;

/**
 * The minimal shape this hook reads off a grid instance. `GridInstance`
 * satisfies it structurally, which keeps the hook testable against a bare
 * object.
 */
export interface RowsSource<TRow extends object, TGroup, TKey extends string | number> {
  descriptor: GridDescriptor<TRow, TGroup, TKey>;
  storeRef: { current: RowStore<TRow, TKey> | null };
  pendingStoreRef: { current: RowStore<TRow, TKey> | null };
  bumpDataGeneration: () => void;
}

/** Reports whether a key was already written by a newer flush. */
type IsStale<TKey> = (key: TKey) => boolean;

/**
 * Subscribes to the descriptor's change feed and keeps the row store current.
 *
 * Messages buffer for a moment, then `planPushes` decides what to do. The
 * grid owns no transport: a SignalR hub, a WebSocket, or a poll all satisfy
 * `descriptor.api.subscribe`. When the descriptor declares no `subscribe`,
 * the hook does nothing.
 *
 * `collapsedGroups` is read through a ref rather than the effect's own
 * dependency array. A caller that passes a fresh array literal on every
 * render (the common case) would otherwise give the effect a new dependency
 * identity each render, tearing the subscription down and re-creating it —
 * dropping whatever is mid-buffer and churning the transport. The ref always
 * holds the latest value, so a genuine collapse-state change still reaches
 * the recount invalidation the next time a flush runs; only the subscribe/
 * unsubscribe lifecycle is decoupled from it.
 *
 * The stores are read the same way, but through the two cells `GridInstance`
 * already carries: a store belongs to whichever grid is mounted, and both cells
 * change value while the subscription lives — `storeRef` when a grid mounts or
 * a hold adopts, `pendingStoreRef` whenever a hold opens or closes. If the
 * effect depended on either store VALUE, every one of those moments would tear
 * the subscription down and rebuild it — the exact failure `collapsedGroups`
 * avoids above, and worse here because it hits a real-time transport instead of
 * a recount. Depending on the refs instead means the effect depends on two
 * identities that never change, so the subscription outlives whatever stores
 * are current; `flush` reads both cells fresh each time it runs.
 *
 * `repaintRows` is the grid's one damage callback (`hooks/useRepaintRows.ts`).
 * An update patches a stored row in place, bumps no generation and invalidates
 * no query, so nothing re-renders and nothing else can put the new value on
 * screen: without this call the row keeps the value it was drawn with until its
 * page is evicted.
 */
export function useRowSync<TRow extends object, TGroup, TKey extends string | number>(
  instance: RowsSource<TRow, TGroup, TKey>,
  collapsedGroups: TGroup[],
  repaintRows: (dataIndexes: number[]) => void,
): void {
  const { descriptor, storeRef, pendingStoreRef, bumpDataGeneration } = instance;

  const queryClient = useQueryClient();

  const collapsedGroupsRef = useRef(collapsedGroups);
  collapsedGroupsRef.current = collapsedGroups;

  // Read through a ref for the same reason the stores are. A caller that builds
  // a fresh callback per render would otherwise tear the subscription down and
  // rebuild it on every render. `DataGrid` passes a memoised one, but this hook
  // has to be correct on its own.
  const repaintRowsRef = useRef(repaintRows);
  repaintRowsRef.current = repaintRows;

  const buffer = useRef<RowChange<TKey>[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSequence = useRef<number | null>(null);

  useEffect(() => {
    const subscribe = descriptor.api.subscribe;

    if (!subscribe) {
      return;
    }

    // `cancelled` guards every write a flush makes after an `await`. Without
    // it, an unmount that lands while `flush` is mid-fetch would still write
    // to a store the caller has already torn down (and, in a test, one the
    // assertions have finished with).
    let cancelled = false;

    const runOrdered = createWriteOrdering<TKey>();

    /**
     * Declares every loaded row wrong, for a create or a delete.
     *
     * It clears NOTHING the user is looking at. `useGridData` folds the
     * generation into its state key, so the bump builds a second store and
     * fills it behind the rows already on screen, exactly as a sort change
     * does. Emptying the displayed store here was the old answer, and it
     * blanked the grid twice over: once because every visible cell fell back to
     * a loading cell, and once because a bare reset re-runs no load effect, so
     * every page read `missing` with nobody left to ask for it.
     *
     * The page cache goes first. It is a second copy of the same rows, keyed by
     * page and not by generation, so leaving it would let the replacement store
     * refill itself from the very response the push just invalidated.
     * `rowsKeyPrefix` is a PREFIX, so this catches every page under every sort
     * and collapse set.
     */
    const invalidateEveryRow = () => {
      queryClient.removeQueries({ queryKey: rowsKeyPrefix(descriptor.name) });

      bumpDataGeneration();
    };

    const flush = async () => {
      timer.current = null;

      const changes = buffer.current;
      buffer.current = [];

      if (changes.length === 0) {
        return;
      }

      // Read once per flush, not once per statement below, so one flush's
      // writes land on one set of stores. A grid that remounts mid-flush, or a
      // hold that adopts mid-flush, then cannot split a single plan's work
      // across two different pairs.
      //
      // The displayed store is kept apart from the pair because only ITS
      // numbering names a row on screen. See the damage list below.
      const displayedStore = storeRef.current;
      const stores = liveStores(displayedStore, pendingStoreRef.current);

      // No grid is mounted, so there is nothing on screen for this push to
      // correct. The next mount loads fresh rows anyway.
      if (stores.length === 0) {
        return;
      }

      // ANY live store counts as "loaded". During a hold the pending store may
      // hold a page the displayed one never fetched — the window moved while
      // the hold was open — and asking the displayed store alone would drop
      // that row's update as a row nobody has.
      const plan = planPushes(
        changes,
        (key) => stores.some((store) => store.indexOfKey(key) !== undefined),
        lastSequence.current,
      );
      lastSequence.current = Math.max(...changes.map((change) => change.sequence));

      if (!hasWork(plan)) {
        return;
      }

      await runOrdered(async (isStale) => {
        const rows =
          plan.refetchIds.length > 0
            ? await Promise.all(plan.refetchIds.map((id) => descriptor.api.fetchRow(id)))
            : [];

        if (cancelled) {
          return;
        }

        const deleteIds = plan.deleteIds.filter((id) => !isStale(id));

        // A delete shifts every position after it, so the loaded pages are
        // wrong. The generation bump loads their replacements behind the rows
        // already on screen; clearing here would blank the grid instead.
        if (deleteIds.length > 0) {
          invalidateEveryRow();
        }

        const present = rows.filter((row) => row !== null) as TRow[];

        const upsertRows = present.filter((row) => !isStale(descriptor.rowKey(row)));

        // An UPDATE moves nothing, so it patches the one row it names in every
        // live store rather than invalidating the window for one cell. That
        // patch bumps no generation and invalidates no query, so the damage
        // call below is the only thing that puts the new value on screen.
        //
        // `patchRow` answers with the index it wrote, and the two stores number
        // their rows differently: the pending store may hold a different sort,
        // a different collapse set, or the same rows shifted by a create. Only
        // the DISPLAYED store's answer may reach the damage callback, because
        // only that store's numbering describes what the grid is drawing. The
        // pending store is drawn by nothing, so its answer is dropped.
        //
        // `patchRow` answers undefined when a store does not hold the row at
        // all, which is a row nobody can see. That is skipped, not an error.
        if (upsertRows.length > 0) {
          const damagedIndexes: number[] = [];

          for (const row of upsertRows) {
            const key = descriptor.rowKey(row);

            for (const store of stores) {
              const index = store.patchRow(key, row);

              if (store === displayedStore && index !== undefined) {
                damagedIndexes.push(index);
              }
            }
          }

          // One call for the whole flush, not one per row: the damage list is
          // bounded by the rows one buffer window names, and glide walks it
          // once.
          if (damagedIndexes.length > 0) {
            repaintRowsRef.current(damagedIndexes);
          }
        }

        // A create moves every position after it, for the same reason a delete
        // does.
        if (plan.reload) {
          invalidateEveryRow();
        }

        if (plan.recount) {
          await queryClient.invalidateQueries({
            queryKey: rowCountKey(descriptor.name, collapsedGroupsRef.current),
          });
        }
      });
    };

    const stop = subscribe((change) => {
      buffer.current.push(change);

      if (timer.current !== null) {
        return;
      }

      timer.current = setTimeout(() => {
        // A flush that throws (e.g. a rejected `fetchRow`) must not stop
        // later flushes — each is independent, but an unhandled rejection
        // would still surface as a console error, so it is swallowed here.
        void flush().catch(() => {});
      }, PUSH_BUFFER_MS);
    });

    return () => {
      cancelled = true;
      stop();

      if (timer.current !== null) {
        clearTimeout(timer.current);
      }

      timer.current = null;
      buffer.current = [];
    };
  }, [descriptor, storeRef, pendingStoreRef, bumpDataGeneration, queryClient]);
}

/**
 * Every store one push must keep current, the displayed one first.
 *
 * Outside a hold that is one store. During a hold it is two, and both need the
 * write for different reasons: the displayed store is what the user reads until
 * adoption, and the pending store is what adoption puts on screen straight
 * afterwards. Patch only the first and the value is right for one round trip
 * and then wrong for good, because `useRowPages` fetches with no observer, so
 * nothing ever refetches a page that already reads `loaded`.
 *
 * It is never three. `hooks/useGridData.ts` holds exactly two view states, and a
 * second state key replaces the pending one rather than adding to it.
 *
 * It takes the two store VALUES, not the two cells. The caller reads each cell
 * once per flush and keeps the displayed one by name, because only that store's
 * indexes may reach the damage callback.
 */
function liveStores<TRow extends object, TKey extends string | number>(
  displayed: RowStore<TRow, TKey> | null,
  pending: RowStore<TRow, TKey> | null,
): RowStore<TRow, TKey>[] {
  const stores: RowStore<TRow, TKey>[] = [];

  if (displayed !== null) {
    stores.push(displayed);
  }

  // The identity check covers the one render between an adoption writing
  // `storeRef` and the next render clearing this cell. Writing the same store
  // twice is harmless, but reading it twice would let one row count as two.
  if (pending !== null && pending !== displayed) {
    stores.push(pending);
  }

  return stores;
}

/** Reports whether a plan asks for anything at all. */
function hasWork<TKey extends string | number>(plan: PushPlan<TKey>): boolean {
  return plan.deleteIds.length > 0 || plan.refetchIds.length > 0 || plan.reload || plan.recount;
}

/**
 * Orders flush *commits* without serializing flush *execution*, and does so
 * per key.
 *
 * The only real hazard is "an older `fetchRow` result overwrites a newer value
 * for the SAME row", not "this flush conflicts with every other flush". Two
 * pushes to the same row, far enough apart to land in separate buffer windows,
 * start two independent `fetchRow` calls whose responses can resolve in either
 * order; the older one landing last must not overwrite the newer one for THAT
 * row.
 *
 * A global guard — an older flush discards ALL of its writes if any newer
 * flush committed anything, anywhere — is wrong on two counts. An unrelated
 * flush that touches different keys, or does no per-key work at all (e.g. an
 * update for a row nobody has loaded), would wrongly drop a legitimate write.
 * And `reload`/`recount` are not per-key overwrites, so nothing about them can
 * be "stale" the way a row write can; gating them the same way silently drops
 * a recount (wrong total on screen) or a reload (a new row never appears).
 *
 * So the rules are:
 *
 * - `appliedGenerationByKey` tracks, per key, the generation that last wrote
 *   it. An upsert or delete for a key is skipped only if a strictly newer
 *   generation already wrote THAT key — every other key is untouched.
 * - `reload` and `recount` run unconditionally whenever their flush's plan
 *   asked for them, regardless of what any other flush did.
 * - A flush whose plan is entirely empty never reaches this function, so it
 *   cannot advance the ordering state for work that never happened.
 *
 * `appliedGenerationByKey` only needs to hold a key's generation while an
 * OLDER flush might still be in flight and about to write that key. Once
 * nothing is in flight, no future ordering decision can depend on any past
 * generation, so the whole map is dead weight — one entry per distinct row key
 * ever touched, held for the life of the effect, is unbounded retention on a
 * long session over a large grid. `inFlight` counts the flushes now doing real
 * work, and it drops in a `finally`, so it comes back down whether the flush
 * finishes normally, returns early, or its `fetchRow` rejects. When it returns
 * to zero, the map is cleared.
 *
 * A `fetchRow` that never settles never reaches its `finally`, so `inFlight`
 * never returns to zero and the map never clears while it hangs. That is
 * correct: the stuck flush might still resolve and need its own per-key check
 * honored, so nothing is safe to forget yet.
 */
function createWriteOrdering<TKey extends string | number>() {
  let latestGeneration = 0;
  let inFlight = 0;

  const appliedGenerationByKey = new Map<TKey, number>();

  return async function runOrdered(
    commit: (isStale: IsStale<TKey>) => Promise<void>,
  ): Promise<void> {
    latestGeneration += 1;
    inFlight += 1;

    const generation = latestGeneration;

    const isStale: IsStale<TKey> = (key) => {
      const appliedGeneration = appliedGenerationByKey.get(key) ?? 0;

      if (generation <= appliedGeneration) {
        return true;
      }

      appliedGenerationByKey.set(key, generation);

      return false;
    };

    try {
      await commit(isStale);
    } finally {
      inFlight -= 1;

      if (inFlight === 0) {
        appliedGenerationByKey.clear();
      }
    }
  };
}
