// Curated, domain-agnostic set of Radix Themes color scales used for enum badges.
//
// IMPORTANT: every scale listed in RADIX_BADGE_SCALES MUST have its
// `tokens/colors/<scale>.css` imported in `src/theme/radixStyles.ts`. Otherwise
// getComputedStyle resolves its CSS vars to '' and `softBadge.tsx` warns. Keep
// this list and radixStyles.ts in sync.

/** All scales an enum badge may use (default sequence + semantic overrides). */
export const RADIX_BADGE_SCALES = [
  "iris",
  "tomato",
  "amber",
  "grass",
  "cyan",
  "plum",
  "orange",
  "jade",
  "crimson",
  "indigo",
  // Extra scales reserved for semantic overrides (also imported in radixStyles.ts):
  "red",
  "green",
] as const;

export type RadixColor = (typeof RADIX_BADGE_SCALES)[number];

/** Ordered subset used for deterministic, value-driven default coloring. */
export const BADGE_SEQUENCE = [
  "iris",
  "tomato",
  "amber",
  "grass",
  "cyan",
  "plum",
  "orange",
  "jade",
  "crimson",
  "indigo",
] as const satisfies readonly RadixColor[];

/**
 * Deterministic default color for an enum value (the "index parity" rule):
 * value -> BADGE_SEQUENCE[value mod length]. Guards negatives / non-integers.
 */
export function radixColorByIndex(index: number): RadixColor {
  const n = BADGE_SEQUENCE.length;
  const i = ((Math.trunc(index) % n) + n) % n;

  return BADGE_SEQUENCE[i];
}
