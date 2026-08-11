import type { Theme } from "@glideapps/glide-data-grid";
import { useEffect } from "react";
import { useAppSelector } from "../app/store";
import { invalidateBadgeColorCache } from "../lib/grid/softBadge";
import { themeForAppearance } from "./gridThemes";

/**
 * Current grid theme, driven by the OS colour scheme. Grids pass the
 * result straight to <DataEditor theme={...} />.
 *
 * Badge colors are read from CSS vars and cached; the cache is dropped whenever
 * appearance changes so canvas pills re-resolve for the new light/dark theme.
 */
export function useGridTheme(): Partial<Theme> {
  const appearance = useAppSelector((s) => s.appearance.appearance);

  useEffect(() => {
    invalidateBadgeColorCache();
  }, [appearance]);

  return themeForAppearance(appearance);
}
