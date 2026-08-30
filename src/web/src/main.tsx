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
// The grid's own stylesheets. `radix-styles` is a side-effect module carrying
// the Radix Themes component CSS plus every colour scale an enum badge can land
// on; without it the badges draw with unresolved CSS variables. `datagrid.css`
// is layout only, on `dg:`-prefixed classes, and resets nothing of ours.
import "@matthewhsu1/datagrid/radix-styles";
import "@matthewhsu1/datagrid/datagrid.css";
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
