import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "svgo": "svgo/browser",
    },
  },
  plugins: [
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
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  },
  worker: {
    format: 'es',
    plugins: () => [
      wasm(),
      topLevelAwait()
    ]
  },
  optimizeDeps: {
    exclude: ['@resvg/resvg-wasm', '@jsquash/avif'],
    include: ['jotai', 'jotai-family', '@tanstack/react-virtual']
  },
  build: {
    target: 'esnext',
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'react-core';
            }
            if (id.includes('jotai')) {
              return 'state';
            }
            if (id.includes('@jsquash') || id.includes('libimagequant')) {
              return 'wasm-codecs';
            }
            if (id.includes('@radix-ui')) {
              return 'ui-radix';
            }
            if (id.includes('@tanstack/react-virtual')) {
              return 'virtual';
            }
            if (id.includes('fflate') || id.includes('file-type') || id.includes('comlink')) {
              return 'utils';
            }
          }
        },
      },
    },
  }
});
