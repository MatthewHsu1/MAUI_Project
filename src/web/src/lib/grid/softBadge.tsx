import type { RadixColor } from "./radixBadgePalette";

export interface ResolvedBadgeColors {
  bg: string; // soft background  (--{color}-a3)
  text: string; // label text     (--{color}-11)
  dot: string; // accent dot      (--{color}-9)
}

// Resolved-color cache. Keyed by scale only; cleared by invalidateBadgeColorCache
// when the light/dark appearance flips (the CSS vars themselves auto-reflect it).
const cache = new Map<RadixColor, ResolvedBadgeColors>();
const warned = new Set<RadixColor>();
let root: Element | null = null;

function themeRoot(): Element {
  if (root && root.isConnected) {
    return root;
  }

  root = document.querySelector(".radix-themes") ?? document.documentElement;

  return root;
}

/**
 * Clear the resolved-color cache (call when appearance flips light/dark) and drop
 * the cached theme-root element so it is re-queried on next use.
 */
export function invalidateBadgeColorCache(): void {
  cache.clear();
  root = null;
}

/**
 * Resolve a Radix scale to concrete soft-badge colors the canvas can use.
 * Reads --{color}-a3/-11/-9 from the Themes root (auto-reflects appearance).
 * Unresolved scales (CSS not imported) return empties and warn once.
 */
export function resolveRadixSoft(color: RadixColor): ResolvedBadgeColors {
  const hit = cache.get(color);

  if (hit) {
    return hit;
  }

  const cs = getComputedStyle(themeRoot());

  const read = (step: string) => cs.getPropertyValue(`--${color}-${step}`).trim();

  const resolved: ResolvedBadgeColors = { bg: read("a3"), text: read("11"), dot: read("9") };

  if (!resolved.dot) {
    if (!warned.has(color)) {
      warned.add(color);

      console.warn(
        `[softBadge] Radix scale "${color}" resolved to empty — is tokens/colors/${color}.css imported in src/theme/radixStyles.ts?`,
      );
    }

    return resolved; // do not cache failures (allows recovery after HMR/import fix)
  }

  cache.set(color, resolved);
  return resolved;
}

/**
 * Draw a Radix-soft-Badge-style pill on the grid canvas: soft bg fill, a small
 * solid dot, then the label — full-pill radius, left-aligned, clipped to the cell.
 * `font` must be the caller's canvas font (e.g. glide's theme.baseFontFull) so the
 * measured text width matches what gets rendered.
 */
export function drawSoftBadge(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  color: RadixColor,
  label: string,
  font: string,
): void {
  const { bg, text, dot } = resolveRadixSoft(color);

  if (!dot) {
    return; // unresolved scale; already warned
  }

  // Layout across the pill interior: innerPadX | dot(2*dotR) | gap | text | innerPadX
  const PAD = 8;
  const innerPadX = 10;
  const dotR = 3;
  const gap = 6;
  const h = Math.min(22, rect.height - 8);
  const y = rect.y + (rect.height - h) / 2;
  const x = rect.x + PAD;
  const radius = h / 2;
  const cy = y + h / 2;

  const maxW = rect.width - PAD * 2;
  if (maxW <= 0) return;

  ctx.font = font; // set before measuring so width matches what we render
  const textW = ctx.measureText(label).width;
  const badgeW = Math.min(innerPadX + dotR * 2 + gap + textW + innerPadX, maxW);

  ctx.beginPath();
  ctx.roundRect(x, y, badgeW, h, radius);
  ctx.fillStyle = bg;
  ctx.fill();

  const dotX = x + innerPadX + dotR;
  ctx.beginPath();
  ctx.arc(dotX, cy, dotR, 0, Math.PI * 2);
  ctx.fillStyle = dot;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, badgeW, h);
  ctx.clip();
  ctx.fillStyle = text;
  ctx.textBaseline = "middle";
  ctx.fillText(label, dotX + dotR + gap, cy + 0.5);
  ctx.restore();
}
