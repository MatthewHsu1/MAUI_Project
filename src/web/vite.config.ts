import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// HybridWebView serves from a virtual root; assets must use relative paths.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "../AppName.Maui/Resources/Raw/web",
    emptyOutDir: true,
  },
});
