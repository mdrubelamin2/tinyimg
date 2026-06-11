/** Memoizes resolved source Files per queue item to avoid repeated storage lookups during dispatch. */
const cache = new Map<string, File>()

export function getCachedSourceFile(itemId: string): File | undefined {
  return cache.get(itemId)
}

export function invalidateSourceFileCache(itemId?: string): void {
  if (itemId) {
    cache.delete(itemId)
    return
  }
  cache.clear()
}

export function setCachedSourceFile(itemId: string, file: File): void {
  cache.set(itemId, file)
}
