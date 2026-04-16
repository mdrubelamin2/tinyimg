import { describe, expect, it } from 'vitest';
import zipWorkerUrl from '@zip.js/zip.js/dist/zip-web-worker.js?url';
import zipWasmUrl from '@zip.js/zip.js/dist/zip-module.wasm?url';

/**
 * Ensures Vite resolves zip.js worker + wasm as URLs (required for configure() in the app).
 */
describe('zip.js Vite worker assets', () => {
  it('resolves worker script URL', () => {
    expect(typeof zipWorkerUrl).toBe('string');
    expect(zipWorkerUrl.length).toBeGreaterThan(0);
    expect(zipWorkerUrl).toMatch(/\.js($|\?)/);
  });

  it('resolves wasm URL', () => {
    expect(typeof zipWasmUrl).toBe('string');
    expect(zipWasmUrl.length).toBeGreaterThan(0);
    expect(zipWasmUrl).toMatch(/\.wasm($|\?)/);
  });
});
