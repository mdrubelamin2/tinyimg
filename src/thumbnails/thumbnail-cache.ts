/** Max cached thumbnail object URLs; over cap evicts oldest non-visible rows first (see pickEvictionVictim). */
const MAX_ENTRIES = 500;

const lruOrder: string[] = [];
const urlById = new Map<string, string>();

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
  return urlById.get(id);
}

/** Oldest non-visible id, or oldest overall if every cached id is visible (must still evict). */
function pickEvictionVictim(): string | undefined {
  const visible = getVisibleThumbnailIds?.() ?? null;
  if (visible && visible.size > 0) {
    for (let i = 0; i < lruOrder.length; i++) {
      const id = lruOrder[i]!;
      if (!visible.has(id)) return id;
    }
  }
  return lruOrder[0];
}

function removeFromLruOrder(id: string): void {
  const i = lruOrder.indexOf(id);
  if (i >= 0) lruOrder.splice(i, 1);
}

function touch(id: string): void {
  removeFromLruOrder(id);
  lruOrder.push(id);
  while (lruOrder.length > MAX_ENTRIES) {
    const evict = pickEvictionVictim();
    if (!evict) break;
    removeFromLruOrder(evict);
    const u = urlById.get(evict);
    if (u) URL.revokeObjectURL(u);
    urlById.delete(evict);
    onEvictFromCache?.(evict);
  }
}

export function thumbnailCacheSet(id: string, objectUrl: string): void {
  const prev = urlById.get(id);
  if (prev && prev !== objectUrl) URL.revokeObjectURL(prev);
  urlById.set(id, objectUrl);
  touch(id);
}

export function thumbnailCacheRevoke(id: string): void {
  const u = urlById.get(id);
  if (u) URL.revokeObjectURL(u);
  urlById.delete(id);
  removeFromLruOrder(id);
}

export function thumbnailCacheClear(): void {
  for (const u of urlById.values()) {
    URL.revokeObjectURL(u);
  }
  urlById.clear();
  lruOrder.length = 0;
}
