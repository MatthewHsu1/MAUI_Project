import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    server: {
      deps: {
        // The grid engine's entry imports glide-data-grid's stylesheet. Vitest
        // externalises node_modules by default, so that import reaches Node
        // untransformed and throws "Unknown file extension .css". Inlining the
        // package routes it through Vite, which handles the CSS.
        inline: ["@matthewhsu1/datagrid"],
      },
    },
  },
});
