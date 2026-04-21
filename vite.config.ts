import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { visualizer } from 'rollup-plugin-visualizer';

const analyze = process.env.ANALYZE === 'true';

/** COOP + COEP — cross-origin isolation (SharedArrayBuffer / WASM); keep in sync with `public/_headers`. */
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const;

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      svgo: 'svgo/browser',
    },
  },
  plugins: [
    wasm(),
    topLevelAwait(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (react as any)({
      babel: {
        plugins: [
          // Legend State: wrap Memo/Show/Computed children for React Compiler compatibility
          '@legendapp/state/babel',
          'babel-plugin-react-compiler',
        ],
      },
    }),
    tailwindcss(),
    ...(analyze
      ? [
          visualizer({
            filename: 'dist/stats.html',
            gzipSize: true,
            brotliSize: true,
            open: false,
          }),
        ]
      : []),
  ],
  server: {
    port: 5174,
    strictPort: true,
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },
  optimizeDeps: {
    exclude: ['@resvg/resvg-wasm'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('react-virtuoso')) return 'virtuoso';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('@legendapp')) return 'legend';
          if (id.includes('@fontsource')) return 'fonts';
          if (id.includes('zustand')) return 'zustand';
          if (id.includes('sonner')) return 'sonner';
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor';
          if (id.includes('@jsquash')) return 'jsquash';
          if (id.includes('zip.js') || id.includes('@zip.js')) return 'zip-js';
          if (id.includes('svgo')) return 'svgo';
          if (id.includes('class-variance-authority') || id.includes('clsx') || id.includes('tailwind-merge'))
            return 'ui-utils';
          return 'vendor';
        },
      },
    },
  },
});
