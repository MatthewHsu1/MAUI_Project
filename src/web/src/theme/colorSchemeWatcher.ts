import { setAppearance, type Appearance } from "./appearanceSlice";

// The WebView inherits the OS/app colour scheme, so the CSS media query is our
// appearance signal.
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Maps a `prefers-color-scheme: dark` match to an appearance.
 */
export function appearanceFromMatches(matches: boolean): Appearance {
  return matches ? "dark" : "light";
}

type Dispatch = (action: ReturnType<typeof setAppearance>) => unknown;

/**
 * Watches the OS colour scheme and pushes the current appearance into the store,
 * once at start and again on every change. Returns a stop function.
 *
 * Environments without matchMedia (jsdom, older WebViews) default to light and
 * get a no-op stop.
 */
export function startColorSchemeWatcher(dispatch: Dispatch): () => void {
  const mql = globalThis.matchMedia?.(DARK_QUERY) ?? null;

  const sync = () => dispatch(setAppearance(appearanceFromMatches(mql?.matches ?? false)));

  sync();

  if (!mql) {
    return () => {};
  }

  mql.addEventListener("change", sync);

  return () => mql.removeEventListener("change", sync);
}
