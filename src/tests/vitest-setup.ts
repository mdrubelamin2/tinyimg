/**
 * poolifier-web-worker selects runtime at import time (`window` + `navigator` ⇒ browser).
 * Vitest uses `environment: node` — stub minimal globals before any test file imports the pool.
 */
if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
}
if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    value: { hardwareConcurrency: 4 },
    configurable: true,
  });
}
