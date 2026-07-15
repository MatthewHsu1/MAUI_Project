import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// HybridWebView serves from a virtual root; assets must use relative paths.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    outDir: "../AppName.Maui/Resources/Raw/web",
    emptyOutDir: true,
  },
});
