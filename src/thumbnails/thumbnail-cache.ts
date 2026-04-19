/** Max cached thumbnail object URLs; over cap evicts oldest non-visible rows first (see pickEvictionVictim). */
const MAX_ENTRIES = 500;

const lruMap = new Map<string, string>();

/** Called when LRU evicts an id so the UI can drop stale preview URLs and re-queue thumbnails. */
let onEvictFromCache: ((id: string) => void) | null = null;

/** Returns Virtuoso-visible row ids; eviction prefers ids not in this set. */
let getVisibleThumbnailIds: (() => ReadonlySet<string>) | null = null;

export function setThumbnailEvictionHandler(fn: (id: string) => void): void {
  onEvictFromCache = fn;
}

export function setThumbnailVisibleIdsGetter(fn: () => ReadonlySet<string>): void {
  getVisibleThumbnailIds = fn;
}

export function thumbnailCachePeek(id: string): string | undefined {
  return lruMap.get(id);
}

/** Oldest non-visible id, or oldest overall if every cached id is visible (must still evict). */
function pickEvictionVictim(): string | undefined {
  const visible = getVisibleThumbnailIds?.() ?? null;
  if (visible && visible.size > 0) {
    for (const id of lruMap.keys()) {
      if (!visible.has(id)) return id;
    }
  }
  return lruMap.keys().next().value;
}

function touch(id: string): void {
  const url = lruMap.get(id);
  if (url === undefined) return;

  lruMap.delete(id);
  lruMap.set(id, url);

  while (lruMap.size > MAX_ENTRIES) {
    const evictId = pickEvictionVictim();
    if (!evictId) break;

    const u = lruMap.get(evictId);
    if (u) URL.revokeObjectURL(u);
    lruMap.delete(evictId);
    onEvictFromCache?.(evictId);
  }
}

export function thumbnailCacheSet(id: string, objectUrl: string): void {
  const prev = lruMap.get(id);
  if (prev && prev !== objectUrl) URL.revokeObjectURL(prev);
  lruMap.set(id, objectUrl);
  touch(id);
}

export function thumbnailCacheRevoke(id: string): void {
  const u = lruMap.get(id);
  if (u) URL.revokeObjectURL(u);
  lruMap.delete(id);
}

export function thumbnailCacheClear(): void {
  for (const u of lruMap.values()) {
    URL.revokeObjectURL(u);
  }
  lruMap.clear();
}
