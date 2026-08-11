import type { RowChange } from "../../types";

export interface PushPlan<TKey extends string | number> {
  /** Rows to fetch again and upsert by key. */
  refetchIds: TKey[];
  /** Rows to drop from the collection. */
  deleteIds: TKey[];
  /** Reload the loaded span: positions moved. */
  reload: boolean;
  /** Ask the server for the total again. */
  recount: boolean;
}

/**
 * Turns a buffer of change notifications into one plan. Pure, so every rule
 * below is a test case rather than a behaviour someone has to reproduce in a
 * browser.
 *
 * Two rules carry the design:
 *
 * - An update for a key the collection does not hold is dropped. Under
 *   on-demand sync an absent row means "not loaded", not "does not exist", and
 *   upserting it would push a row into a span that must not contain it.
 * - A create reloads instead of upserting. A new row shifts every position
 *   after it, so the span has to come again from the server.
 */
export function planPushes<TKey extends string | number>(
  changes: RowChange<TKey>[],
  isLoaded: (key: TKey) => boolean,
  lastSequence: number | null,
): PushPlan<TKey> {
  const plan: PushPlan<TKey> = {
    refetchIds: [],
    deleteIds: [],
    reload: false,
    recount: false,
  };

  if (changes.length === 0) {
    return plan;
  }

  // A hole in the sequence means the buffer is incomplete, so rebuild the span.
  if (lastSequence !== null && hasGap(changes, lastSequence)) {
    return {
      refetchIds: [],
      deleteIds: [],
      reload: true,
      recount: true,
    };
  }

  for (const change of latestChangePerId(changes)) {
    if (change.kind === "delete") {
      plan.deleteIds.push(change.id);
      plan.recount = true;
      continue;
    }

    if (change.kind === "create") {
      plan.reload = true;
      plan.recount = true;
      continue;
    }

    if (isLoaded(change.id)) {
      plan.refetchIds.push(change.id);
    }
  }

  return plan;
}

/**
 * Keeps one change per id: the one with the highest sequence. An update
 * followed by a delete is a delete.
 */
function latestChangePerId<TKey extends string | number>(
  changes: RowChange<TKey>[],
): RowChange<TKey>[] {
  const ordered = [...changes].sort((a, b) => a.sequence - b.sequence);

  const latest = new Map<TKey, RowChange<TKey>>();

  for (const change of ordered) {
    latest.set(change.id, change);
  }

  return [...latest.values()];
}

function hasGap<TKey extends string | number>(
  changes: RowChange<TKey>[],
  lastSequence: number,
): boolean {
  // Deduplicate before the scan. Redelivery of an already-seen sequence is
  // normal, and a repeated number can never hide a genuinely missing integer.
  const unique = new Set(changes.map((change) => change.sequence));

  const sequences = [...unique].sort((a, b) => a - b);

  // The buffer must start directly after the last sequence seen.
  if (sequences[0] > lastSequence + 1) {
    return true;
  }

  // Each later sequence must be exactly 1 more than the one before it.
  for (let i = 1; i < sequences.length; i++) {
    if (sequences[i] !== sequences[i - 1] + 1) {
      return true;
    }
  }

  return false;
}
