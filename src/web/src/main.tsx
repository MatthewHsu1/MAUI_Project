import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { RouterProvider } from "@tanstack/react-router";
import { store } from "./app/store";
import { router } from "./app/router";
import "./index.css";
import "./tailwind.css";
import "./theme/radixStyles";
import { RadixThemeProvider } from "./theme/RadixThemeProvider";
import { startColorSchemeWatcher } from "./theme/colorSchemeWatcher";

startColorSchemeWatcher(store.dispatch);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <RadixThemeProvider>
        <RouterProvider router={router} />
      </RadixThemeProvider>
    </Provider>
  </StrictMode>,
);
