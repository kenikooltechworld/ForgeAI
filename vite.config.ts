import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/webview',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/webview/index.tsx'),
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Use static name for CSS to avoid hardcoding hash in extension
          if (assetInfo.name === 'style.css') {
            return 'style.css';
          }
          return '[name]-[hash][extname]';
        },
      },
    },
    target: 'ES2022',
    minify: 'terser',
    sourcemap: false,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
    global: 'globalThis',
  },
  server: {
    port: 5173,
    hmr: true,
  },
  resolve: {
    alias: {
      '@webview': resolve(__dirname, 'src/webview'),
      '@types': resolve(__dirname, 'src/webview/types'),
    },
  },
});
