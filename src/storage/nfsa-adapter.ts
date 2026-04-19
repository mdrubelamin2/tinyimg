import { getOriginPrivateDirectory } from 'native-file-system-adapter';
import type { QuotaInfo, StorageAdapter } from '@/storage/storage-adapter';
import { fileNameToKey, toFileName } from '@/storage/nfsa-storage-filename';

/** `entries()` exists at runtime; DOM typings may lag behind. */
type RootDir = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

async function resolveRoot(): Promise<RootDir> {
  try {
    const r = await getOriginPrivateDirectory();
    if (r) return r as RootDir;
  } catch {
    /* fall through */
  }
  try {
    const r = await getOriginPrivateDirectory(
      import('native-file-system-adapter/src/adapters/indexeddb.js')
    );
    if (r) return r as RootDir;
  } catch {
    /* fall through */
  }
  const r = await getOriginPrivateDirectory(
    import('native-file-system-adapter/src/adapters/memory.js')
  );
  return r as RootDir;
}

export async function createNfsaAdapter(): Promise<StorageAdapter> {
  const root = await resolveRoot();

  return {
    async set(key: string, data: ArrayBuffer): Promise<void> {
      const name = toFileName(key);
      const handle = await root.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      try {
        await writable.write(data);
        await writable.close();
      } catch (err) {
        await writable.abort().catch(() => {});
        throw err;
      }
    },

    async get(key: string): Promise<ArrayBuffer | null> {
      try {
        const handle = await root.getFileHandle(toFileName(key));
        const file = await handle.getFile();
        return await file.arrayBuffer();
      } catch {
        return null;
      }
    },

    async getBackedFile(key: string): Promise<File | null> {
      try {
        const handle = await root.getFileHandle(toFileName(key));
        return await handle.getFile();
      } catch {
        return null;
      }
    },

    async getWritableHandle(key: string): Promise<FileSystemFileHandle> {
      return root.getFileHandle(toFileName(key), { create: true });
    },

    async delete(key: string): Promise<void> {
      try {
        await root.removeEntry(toFileName(key));
      } catch {
        /* noop */
      }
    },

    async deleteByPrefix(prefix: string): Promise<number> {
      let n = 0;
      for await (const [name] of root.entries()) {
        const decoded = fileNameToKey(name);
        if (decoded == null) continue;
        if (decoded.startsWith(prefix)) {
          try {
            await root.removeEntry(name);
            n++;
          } catch {
            /* noop */
          }
        }
      }
      return n;
    },

    async has(key: string): Promise<boolean> {
      try {
        await root.getFileHandle(toFileName(key));
        return true;
      } catch {
        return false;
      }
    },

    async quota(): Promise<QuotaInfo> {
      const e = await navigator.storage?.estimate?.();
      return { usage: e?.usage ?? 0, quota: e?.quota ?? 0 };
    },

    async clear(): Promise<void> {
      for await (const [name] of root.entries()) {
        if (fileNameToKey(name) == null) continue;
        try {
          await root.removeEntry(name);
        } catch {
          /* noop */
        }
      }
    },
  };
}
