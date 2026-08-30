import { DEFAULT_GRID_RADIX_THEME } from "@matthewhsu1/datagrid";
import { Theme } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { useAppSelector } from "../app/store";

/**
 * Radix Themes root for the app. Reads the shared `appearance` signal (kept in
 * sync with the OS colour scheme by startColorSchemeWatcher) and drives Radix's
 * light/dark mode from it — the same source the grid's own theme uses. Wrap the
 * app once; portalled Radix components (dialogs, menus) re-apply the theme
 * automatically.
 *
 * The accent comes from the grid engine's default rather than a config of our
 * own, so the app and the grid's portalled cell editors agree by construction.
 * A cell editor mounts its own `<Theme>` outside this provider's React tree, so
 * matching it here is the only thing that keeps the two in step. Diverge from
 * the default and this must pass the same values to `configureGridTheme` at
 * app start.
 */
export function RadixThemeProvider({ children }: { children: ReactNode }) {
  const appearance = useAppSelector((s) => s.appearance.appearance);

  return (
    <Theme appearance={appearance} {...DEFAULT_GRID_RADIX_THEME}>
      {children}
    </Theme>
  );
}
