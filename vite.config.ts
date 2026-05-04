import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
    minify: "esbuild",
    cssCodeSplit: false, // Don't split CSS into separate files
    emptyOutDir: false, // Don't clear dist folder (extension files are there)

    codeSplitting: false, // Inline all imports into single bundle (replaces inlineDynamicImports)

    rollupOptions: {
      input: {
        webview: resolve(__dirname, "src/webview/index.tsx"),
      },
      output: {
        entryFileNames: "webview.js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "webview.[ext]", // Extract CSS as webview.css
      },
    },

    chunkSizeWarningLimit: 100,
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "src/webview"),
    },
  },

  server: {
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
