import { vi } from 'vitest'

/**
 * poolifier-web-worker selects runtime at import time (`window` + `navigator` ⇒ browser).
 * Vitest uses `environment: node` — stub minimal globals before any test file imports the pool.
 */
if (globalThis.window === undefined) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  })
}

// Stub matchMedia for tests that check device capabilities
const w = globalThis.window as object
if (!('matchMedia' in w) || typeof (w as { matchMedia?: unknown }).matchMedia !== 'function') {
  Object.defineProperty(w, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(), // deprecated
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(), // deprecated
    })),
    writable: true,
  })
}
if (globalThis.navigator === undefined) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { hardwareConcurrency: 4 },
  })
}

/**
 * ImageData polyfill for node environment (used by icodec and other libraries)
 */
if ((globalThis as unknown as { ImageData: unknown }).ImageData === undefined) {
  ;(globalThis as unknown as { ImageData: unknown }).ImageData = class ImageData {
    data: Uint8ClampedArray
    height: number
    width: number
    constructor(dataOrWidth: number | Uint8ClampedArray, widthOrHeight: number, height?: number) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth
        this.width = widthOrHeight
        this.height = height!
      } else {
        this.width = dataOrWidth
        this.height = widthOrHeight
        this.data = new Uint8ClampedArray(this.width * this.height * 4)
      }
    }
  }
}
