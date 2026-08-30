import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// Two build targets share this config, selected by mode:
//
//   npm run build                  -> the MAUI HybridWebView bundle.
//     HybridWebView serves from a virtual root, so assets must use relative
//     paths, and the output lands in the MAUI project's Raw resources where the
//     BuildReactApp MSBuild target expects it.
//
//   npm run build:web  (mode web)  -> the static site deployed to a web host.
//     Served from the domain root, with deep links rewritten to /index.html, so
//     the base must be absolute: a relative base would make /bonds/1234 resolve
//     its assets against /bonds/ and load nothing.
export default defineConfig(({ mode }) => {
  const isStaticSite = mode === "web";

  return {
    plugins: [
      // Must precede react(): the generator rewrites route files before the
      // React plugin transforms them. Code splitting stays off — dynamic-import
      // chunk URLs are a resolution risk under the virtual root.
      tanstackRouter({ target: "react", autoCodeSplitting: false }),
      react(),
      tailwindcss(),
    ],

    base: isStaticSite ? "/" : "./",

    build: {
      outDir: isStaticSite ? "dist" : "../AppName.Maui/Resources/Raw/web",
      emptyOutDir: true,
    },
  };
});
