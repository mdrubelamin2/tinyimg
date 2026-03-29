import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "svgo": "svgo/dist/svgo.browser.js",
    },
  },
  plugins: [
    nodePolyfills(),
    wasm(),
    topLevelAwait(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (react as any)({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
  ],
  worker: {
    format: 'es',
    plugins: () => [
      nodePolyfills(),
      wasm(),
      topLevelAwait()
    ]
  },
  optimizeDeps: {
    exclude: ['@resvg/resvg-wasm']
  }
});
