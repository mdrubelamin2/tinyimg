import type { StorageAdapter } from '@/storage/storage-adapter';
import { createOpfsAdapter } from '@/storage/opfs-adapter';
import { createIdbSessionAdapter } from '@/storage/idb-adapter';
import { createMemorySessionAdapter } from '@/storage/memory-session-adapter';

let cached: StorageAdapter | null = null;

/**
 * Session hybrid binary storage: cleared on app mount/unmount via {@link clearSessionStorage}.
 *
 * Resolution order: **OPFS** (Chromium) → **IndexedDB** (Firefox / Safari / private mode gaps)
 * → **in-memory** (Vitest / no `indexedDB`). Same `StorageAdapter` contract everywhere.
 */
export async function getSessionBinaryStorage(): Promise<StorageAdapter> {
  if (cached) return cached;
  const opfs = await createOpfsAdapter();
  if (opfs) {
    cached = opfs;
    return cached;
  }
  if (typeof indexedDB !== 'undefined') {
    cached = createIdbSessionAdapter();
    return cached;
  }
  cached = createMemorySessionAdapter();
  return cached;
}

export async function clearSessionStorage(): Promise<void> {
  const s = await getSessionBinaryStorage();
  await s.clear();
}
