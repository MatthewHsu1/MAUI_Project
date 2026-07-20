import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { HashRouter } from "react-router-dom";
import App from "./App.tsx";
import { store } from "./app/store";
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
        <HashRouter>
          <App />
        </HashRouter>
      </RadixThemeProvider>
    </Provider>
  </StrictMode>,
);
