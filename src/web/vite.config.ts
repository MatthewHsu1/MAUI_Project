import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// HybridWebView serves from a virtual root; assets must use relative paths.
export default defineConfig({
  plugins: [
    // Must precede react(): the generator rewrites route files before the
    // React plugin transforms them. Code splitting stays off — dynamic-import
    // chunk URLs are a resolution risk under the virtual root.
    tanstackRouter({ target: "react", autoCodeSplitting: false }),
    react(),
    tailwindcss(),
  ],
  base: "./",
  build: {
    outDir: "../AppName.Maui/Resources/Raw/web",
    emptyOutDir: true,
  },
});
