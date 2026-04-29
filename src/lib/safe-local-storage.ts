export function safeGetItem(key: string): null | string {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* noop */
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Safari private mode, quota — silent fail */
  }
}

/** Zustand-compatible storage object for persist middleware. */
export const safeLocalStorage = {
  getItem: safeGetItem,
  removeItem: safeRemoveItem,
  setItem: safeSetItem,
}
