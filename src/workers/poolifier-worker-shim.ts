/**
 * poolifier-web-worker treats "browser" as `globalThis.window && globalThis.navigator`.
 * Dedicated module workers have `self`/`navigator` but no `window`, so poolifier throws at import time.
 * Run this module before importing anything from `poolifier-web-worker` in worker entries.
 */
if (typeof globalThis.window === 'undefined' && typeof globalThis.self !== 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: globalThis.self, configurable: true });
}
