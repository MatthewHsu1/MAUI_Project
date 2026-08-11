/**
 * In-memory bearer-token store.
 *
 * The token is deliberately never persisted to localStorage or sessionStorage —
 * both are readable by any injected script, and a bearer token there is an XSS
 * escalation into full API access. Losing the token on reload is the intended
 * trade-off; the refresh handler re-obtains one.
 */

/** Obtains a new access token. Replaced wholesale when a real IdP lands. */
export type RefreshHandler = () => Promise<string>;

let accessToken: string | null = null;
let inFlight: Promise<string> | null = null;

const notConfigured: RefreshHandler = () => {
  throw new Error("No refresh handler configured — call setRefreshHandler() during startup.");
};

let refreshHandler: RefreshHandler = notConfigured;

/** The current access token, or null when unauthenticated. */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Sets or clears the access token. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Installs the function that obtains a new access token. This is the single
 * seam a real identity provider replaces; nothing else in the transport knows
 * how tokens are minted.
 */
export function setRefreshHandler(fn: RefreshHandler): void {
  refreshHandler = fn;
}

/**
 * Obtains a fresh access token, collapsing concurrent callers onto one request.
 *
 * A grid fires many requests at once, so an expiring token produces N
 * simultaneous 401s. Without this, each would trigger its own refresh —
 * hammering the token endpoint and, with rotating refresh tokens, invalidating
 * each other's results.
 */
export function refreshAccessToken(): Promise<string> {
  if (inFlight) return inFlight;

  inFlight = Promise.resolve()
    .then(refreshHandler)
    .then((token) => {
      accessToken = token;
      return token;
    })
    .catch((error: unknown) => {
      accessToken = null;
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Test-only: restores module state between cases. */
export function resetAuthTokensForTest(): void {
  accessToken = null;
  inFlight = null;
  refreshHandler = notConfigured;
}
