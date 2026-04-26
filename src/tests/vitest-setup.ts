import { vi } from 'vitest';

/**
 * poolifier-web-worker selects runtime at import time (`window` + `navigator` ⇒ browser).
 * Vitest uses `environment: node` — stub minimal globals before any test file imports the pool.
 */
if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
}

// Stub matchMedia for tests that check device capabilities
const w = globalThis.window as object;
if (!('matchMedia' in w) || typeof (w as { matchMedia?: unknown }).matchMedia !== 'function') {
  Object.defineProperty(w, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    value: { hardwareConcurrency: 4 },
    configurable: true,
  });
}

/**
 * ImageData polyfill for node environment (used by icodec and other libraries)
 */
if (typeof (globalThis as unknown as { ImageData: unknown }).ImageData === 'undefined') {
  (globalThis as unknown as { ImageData: unknown }).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height!;
      } else {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  };
}
