import { Theme } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { useAppSelector } from "../app/store";
import { radixThemeConfig } from "./radixTheme";

/**
 * Radix Themes root for the app. Reads the shared `appearance` signal (kept in
 * sync with the OS colour scheme by startColorSchemeWatcher) and drives Radix's
 * light/dark mode from it — the same source the Glide grid theme uses. Wrap the
 * app once; portalled Radix components (dialogs, menus) re-apply the theme
 * automatically.
 */
export function RadixThemeProvider({ children }: { children: ReactNode }) {
  const appearance = useAppSelector((s) => s.appearance.appearance);

  return (
    <Theme appearance={appearance} {...radixThemeConfig}>
      {children}
    </Theme>
  );
}
