import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import topLevelAwait from 'vite-plugin-top-level-await'
import wasm from 'vite-plugin-wasm'

const analyze = process.env.ANALYZE === 'true'
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
const PORT = Number.parseInt(process.env.PORT || '5173', 10)

// Dynamic import for mkcert to avoid binary download side-effects in CI
const mkcertPlugin = !isCI ? await import('vite-plugin-mkcert').then((m) => m.default()) : null

/** COOP + COEP — cross-origin isolation (SharedArrayBuffer / WASM); keep in sync with `public/_headers`. */
const crossOriginIsolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'cross-origin',
} as const

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@radix-ui')) return 'radix'
          if (id.includes('react-virtuoso')) return 'virtuoso'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('@legendapp')) return 'legend'
          if (id.includes('@fontsource')) return 'fonts'
          if (id.includes('zustand')) return 'zustand'
          if (id.includes('sonner')) return 'sonner'
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor'
          if (id.includes('@jsquash')) return 'jsquash'
          if (id.includes('zip.js') || id.includes('@zip.js')) return 'zip-js'
          if (id.includes('svgo')) return 'svgo'
          if (
            id.includes('class-variance-authority') ||
            id.includes('clsx') ||
            id.includes('tailwind-merge')
          )
            return 'ui-utils'
          return 'vendor'
        },
      },
    },
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  optimizeDeps: {
    exclude: ['@resvg/resvg-wasm'],
  },
  plugins: [
    ...(mkcertPlugin ? [mkcertPlugin] : []),
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
    {
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          for (const [key, value] of Object.entries(crossOriginIsolationHeaders)) {
            res.setHeader(key, value)
          }
          next()
        })
      },
      name: 'configure-response-headers',
    },
    VitePWA({
      devOptions: {
        enabled: true,
        type: 'module',
      },
      filename: 'sw.ts',
      injectManifest: {
        globIgnores: ['assets/*.wasm'],
        globPatterns: ['**/*.{html,webmanifest,svg,png,ico}'],
        injectionPoint: 'self.__WB_MANIFEST',
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
      injectRegister: false,
      manifest: {
        background_color: '#000000',
        description: 'Blazing fast, privacy-first image optimizer for modern web formats.',
        display: 'standalone',
        icons: [
          {
            purpose: 'any',
            sizes: 'any',
            src: 'icons.svg',
            type: 'image/svg+xml',
          },
        ],
        name: 'TinyIMG - Pro Image Optimizer',
        orientation: 'any',
        scope: '/',
        short_name: 'TinyIMG',
        start_url: '/',
        theme_color: '#000000',
      },
      srcDir: 'src',
      strategies: 'injectManifest',
    }),
    ...(analyze
      ? [
          visualizer({
            brotliSize: true,
            filename: 'dist/stats.html',
            gzipSize: true,
            open: false,
          }),
        ]
      : []),
  ],
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      svgo: 'svgo/browser',
    },
  },
  server: {
    cors: true,
    headers: crossOriginIsolationHeaders,
    host: '127.0.0.1',
    port: PORT,
    strictPort: true,
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },
})
