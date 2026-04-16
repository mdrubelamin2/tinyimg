/** True when a storage write failed because quota was exceeded (OPFS / IndexedDB). */
export function isQuotaExceededError(e: unknown): boolean {
  if (e == null) return false;
  if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
    return e.name === 'QuotaExceededError' || e.code === 22;
  }
  if (e instanceof Error) {
    return e.name === 'QuotaExceededError';
  }
  return false;
}
