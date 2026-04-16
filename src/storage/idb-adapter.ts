import { createStore, del, get, keys, set, clear } from 'idb-keyval';
import type { QuotaInfo, StorageAdapter } from '@/storage/storage-adapter';

const STORE_NAME = 'tinyimg-session';
const STORE_VERSION = 1;

const customStore = createStore(STORE_NAME, `kv-v${STORE_VERSION}`);

export function createIdbSessionAdapter(): StorageAdapter {
  return {
    async set(key: string, data: ArrayBuffer): Promise<void> {
      await set(key, data, customStore);
    },
    async get(key: string): Promise<ArrayBuffer | null> {
      const v = await get<ArrayBuffer>(key, customStore);
      return v ?? null;
    },
    async delete(key: string): Promise<void> {
      await del(key, customStore);
    },
    async deleteByPrefix(prefix: string): Promise<number> {
      const all = await keys<string>(customStore);
      let n = 0;
      for (const k of all) {
        if (k.startsWith(prefix)) {
          await del(k, customStore);
          n++;
        }
      }
      return n;
    },
    async has(key: string): Promise<boolean> {
      const v = await get(key, customStore);
      return v != null;
    },
    async quota(): Promise<QuotaInfo> {
      const e = await navigator.storage?.estimate?.();
      return { usage: e?.usage ?? 0, quota: e?.quota ?? 0 };
    },
    async clear(): Promise<void> {
      await clear(customStore);
    },
  };
}
