import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { ApiError } from "./ApiError";
import { getAccessToken, refreshAccessToken } from "./authTokens";

// Program-global: these flags appear on every axios config in the app, but only
// apiClient's interceptors honour them.
declare module "axios" {
  interface AxiosRequestConfig {
    /**
     * Suppresses the 401 refresh-and-retry for this request. Set it on the
     * token request itself: refreshing in response to a failed refresh awaits
     * the in-flight refresh from inside it, which never settles.
     */
    skipAuthRefresh?: boolean;
    /**
     * Internal. Marks a request already retried once after a refresh, so a
     * second 401 is terminal instead of looping.
     */
    retriedAfterRefresh?: boolean;
  }
}

/** How long a request may run before it is aborted. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Reads the API base URL at call time rather than at instance creation, so
 * tests can stub it and so a misconfiguration surfaces as a clear error at the
 * first request instead of a blank screen at import.
 */
function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;

  if (!configured) {
    throw new Error(
      "VITE_API_BASE_URL is not set. Add it to src/web/.env.development (local) " +
        "or the build environment (deployed). There is deliberately no default: " +
        "a silent fallback fails in production as an opaque CORS error.",
    );
  }

  return configured.replace(/\/$/, "");
}

/**
 * The app's HTTP surface. Every request carries the base URL, the bearer token,
 * a timeout, and a single failure shape — see the interceptors below.
 *
 * The fetch adapter is pinned rather than left to axios's environment
 * detection: the MAUI HybridWebView origin is exercised on fetch, and it lets
 * tests stub `globalThis.fetch` instead of jsdom's XHR.
 */
export const apiClient = axios.create({
  adapter: "fetch",
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.baseURL = resolveBaseUrl();

  const token = getAccessToken();

  // The delete branch matters on the 401 retry path: the config object is
  // reused, so a stale header would otherwise survive the refresh.
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  else config.headers.delete("Authorization");

  return config;
});

/** Collapses every axios failure mode into the app's single error shape. */
function toApiError(error: AxiosError): ApiError {
  if (error.code === AxiosError.ETIMEDOUT || error.code === AxiosError.ECONNABORTED)
    return new ApiError(0, "timeout", "Request timed out", error);

  const response = error.response;

  if (!response) return new ApiError(0, "network", "Network request failed", error);

  return new ApiError(
    response.status,
    response.status === 401 ? "unauthorized" : "http",
    `${response.status} ${response.statusText}`,
    response.data,
  );
}

apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  // A cancellation is not a failure. Wrapping it in ApiError — "the single
  // failure shape for every API call" — would make that type lie, and would
  // break every generic cancellation check. Must precede the isAxiosError
  // guard: CanceledError is an AxiosError.
  if (axios.isCancel(error)) throw error;

  // Axios runs request interceptors, the dispatch, and response interceptors as
  // one flat promise chain, so a thrown configuration error arrives here too.
  // Rethrowing anything that is not an AxiosError is what keeps it a plain
  // Error rather than a mislabelled ApiError(0, "network").
  if (!axios.isAxiosError(error)) throw error;

  const config = error.config;

  if (
    error.response?.status === 401 &&
    config &&
    !config.skipAuthRefresh &&
    !config.retriedAfterRefresh
  ) {
    config.retriedAfterRefresh = true;

    try {
      // Single-flight: N concurrent 401s from a scrolling grid share one
      // refresh. That guarantee lives in authTokens, not here.
      await refreshAccessToken();
    } catch (cause) {
      // A transport-level refresh failure is retryable; only an authentication
      // failure is terminal. Relabelling the former as 401 makes queryClient's
      // no-retry-on-4xx rule swallow a network blip that the previous client
      // retried three times.
      if (cause instanceof ApiError && cause.status === 0) throw cause;
      throw new ApiError(401, "unauthorized", "Access token refresh failed", cause);
    }

    // Re-entering request() re-runs the request interceptor, which attaches the
    // new token. A second 401 finds retriedAfterRefresh set and falls through.
    return apiClient.request(config);
  }

  throw toApiError(error);
});
