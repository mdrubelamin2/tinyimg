import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/tests/**/*.test.ts'],
    exclude: ['src/tests/e2e/**'],
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/vitest-setup.ts'],
  },
});
