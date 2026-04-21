/**
 * zip.js global configuration for Vite: bundle worker + wasm as URLs (COEP-friendly).
 * Call {@link ensureZipJsConfigured} before creating ZipReader / ZipWriter in the browser.
 */
import { configure } from '@zip.js/zip.js';
import zipWorkerUrl from '@zip.js/zip.js/dist/zip-web-worker.js?url';
import zipWasmUrl from '@zip.js/zip.js/dist/zip-module.wasm?url';
import { computeOptimalWorkerCount } from '@/capabilities/worker-count';

let configured = false;

export function ensureZipJsConfigured(): void {
  if (configured) return;
  if (typeof window === 'undefined') {
    configured = true;
    return;
  }

  configured = true;
  configure({
    workerURI: zipWorkerUrl,
    wasmURI: zipWasmUrl,
    useWebWorkers: true,
    useCompressionStream: true,
    maxWorkers: computeOptimalWorkerCount(),
  });
}
