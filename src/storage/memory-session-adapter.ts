import type { QuotaInfo, StorageAdapter } from '@/storage/storage-adapter';

/** In-memory session binary store (Vitest / non-browser runtimes). */
export function createMemorySessionAdapter(): StorageAdapter {
  const map = new Map<string, ArrayBuffer>();
  return {
    async set(key: string, data: ArrayBuffer): Promise<void> {
      map.set(key, data.slice(0));
    },
    async get(key: string): Promise<ArrayBuffer | null> {
      const v = map.get(key);
      return v ? v.slice(0) : null;
    },
    async delete(key: string): Promise<void> {
      map.delete(key);
    },
    async deleteByPrefix(prefix: string): Promise<number> {
      let n = 0;
      for (const k of [...map.keys()]) {
        if (k.startsWith(prefix)) {
          map.delete(k);
          n++;
        }
      }
      return n;
    },
    async has(key: string): Promise<boolean> {
      return map.has(key);
    },
    async quota(): Promise<QuotaInfo> {
      let usage = 0;
      for (const v of map.values()) usage += v.byteLength;
      return { usage, quota: Number.MAX_SAFE_INTEGER };
    },
    async clear(): Promise<void> {
      map.clear();
    },
    async getBackedFile(key: string): Promise<File | null> {
      const ab = map.get(key);
      if (!ab) return null;
      return new File([ab], key, { type: 'application/octet-stream' });
    },
  };
}
