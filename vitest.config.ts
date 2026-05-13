import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    exclude: ['src/tests/e2e/**'],
    globals: true,
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['./src/tests/vitest-setup.ts'],
  },
})
