import type { StorageAdapter } from '@/storage/storage-adapter';
import { createNfsaAdapter } from '@/storage/nfsa-adapter';

let cached: StorageAdapter | null = null;

/**
 * Session hybrid binary storage: cleared on app mount/unmount via {@link clearSessionStorage}.
 *
 * Single NFSA-backed implementation: native OPFS when available, else NFSA IndexedDB, else NFSA memory (Vitest / no IDB).
 */
export async function getSessionBinaryStorage(): Promise<StorageAdapter> {
  if (cached) return cached;
  cached = await createNfsaAdapter();
  return cached;
}

export async function clearSessionStorage(): Promise<void> {
  const s = await getSessionBinaryStorage();
  await s.clear();
}
