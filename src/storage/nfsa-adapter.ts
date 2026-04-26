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
    if (r) return r as unknown as RootDir;
  } catch {
    /* fall through */
  }
  try {
    const r = await getOriginPrivateDirectory(
      import('native-file-system-adapter/src/adapters/indexeddb.js')
    );
    if (r) return r as unknown as RootDir;
  } catch {
    /* fall through */
  }
  const r = await getOriginPrivateDirectory(
    import('native-file-system-adapter/src/adapters/memory.js')
  );
  return r as unknown as RootDir;
}

export async function createNfsaAdapter(): Promise<StorageAdapter> {
  const root = await resolveRoot();

  const index = new Map<string, string>();

  for await (const [name] of root.entries()) {
    const key = fileNameToKey(name);
    if (key != null) index.set(key, name);
  }

  return {
    async set(key: string, data: ArrayBuffer): Promise<void> {
      const name = toFileName(key);
      const handle = await root.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      try {
        await writable.write(data);
        await writable.close();
        index.set(key, name);
      } catch (err) {
        await writable.abort().catch(() => {});
        throw err;
      }
    },

    async get(key: string): Promise<ArrayBuffer | null> {
      const name = index.get(key) ?? toFileName(key);
      try {
        const handle = await root.getFileHandle(name);
        const file = await handle.getFile();
        return await file.arrayBuffer();
      } catch {
        return null;
      }
    },

    async getBackedFile(key: string): Promise<File | null> {
      const name = index.get(key) ?? toFileName(key);
      try {
        const handle = await root.getFileHandle(name);
        return await handle.getFile();
      } catch {
        return null;
      }
    },

    async getWritableHandle(key: string): Promise<FileSystemFileHandle> {
      const name = toFileName(key);
      return root.getFileHandle(name, { create: true });
    },

    async delete(key: string): Promise<void> {
      const name = index.get(key) ?? toFileName(key);
      try {
        await root.removeEntry(name);
        index.delete(key);
      } catch {
        /* noop */
      }
    },

    async deleteByPrefix(prefix: string): Promise<number> {
      let n = 0;
      const todo: [string, string][] = [];
      for (const [key, name] of index) {
        if (key.startsWith(prefix)) {
          todo.push([key, name]);
        }
      }

      await Promise.all(todo.map(async ([key, name]) => {
        try {
          await root.removeEntry(name);
          index.delete(key);
          n++;
        } catch {
          /* noop */
        }
      }));
      return n;
    },

    async has(key: string): Promise<boolean> {
      if (index.has(key)) return true;
      try {
        await root.getFileHandle(toFileName(key));
        index.set(key, toFileName(key));
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
      const todo = Array.from(index.entries());
      await Promise.all(todo.map(async ([key, name]) => {
        try {
          await root.removeEntry(name);
          index.delete(key);
        } catch {
          /* noop */
        }
      }));
    },
  };
}
