import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { store } from "./app/store";
import { router } from "./app/router";
import { queryClient } from "./app/queryClient";
import "./index.css";
import "./tailwind.css";
import "./theme/radixStyles";
import { RadixThemeProvider } from "./theme/RadixThemeProvider";
import { startColorSchemeWatcher } from "./theme/colorSchemeWatcher";
import { setRefreshHandler } from "./lib/http/authTokens";
import { apiClient } from "./lib/http/apiClient";

startColorSchemeWatcher(store.dispatch);

// DEV STUB: mints a token from the API's development endpoint, which performs
// no credential check. This is the single seam a real identity provider
// replaces — see src/AppName.Api/Endpoints/AuthEndpoints.cs.
//
// skipAuthRefresh is mandatory here: without it a 401 from this very request
// would trigger a refresh that awaits the in-flight refresh it is inside.
setRefreshHandler(async () => {
  const { data } = await apiClient.post<{ access_token: string }>("/api/auth/token", undefined, {
    skipAuthRefresh: true,
  });
  return data.access_token;
});

/**
 * The worker must be running before the first request leaves the page, so the
 * render waits for it. The dynamic import keeps the mock modules out of the
 * production bundle — see src/mocks/browser.ts.
 */
async function bootstrap() {
  if (import.meta.env.DEV) {
    const { startMocks } = await import("./mocks/browser");

    // Render anyway on a mock-startup failure. Letting this rejection go
    // unhandled would leave a blank page for EVERY route, not just the
    // dev-only pages that depend on the mocks. A page that 404s against the
    // real API is a far clearer symptom than an app that never paints.
    try {
      await startMocks();
    } catch (error) {
      console.error("Failed to start mock service worker.", { cause: error });
    }
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <RadixThemeProvider>
            <RouterProvider router={router} />
          </RadixThemeProvider>
        </Provider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
