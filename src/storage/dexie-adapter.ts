import { Dexie, type EntityTable } from 'dexie'

import type { QuotaInfo, StorageAdapter } from '@/storage/storage-adapter'

interface FileEntry {
  data: ArrayBuffer | Blob
  key: string
}

export function createDexieAdapter(dbName?: string): StorageAdapter {
  class TinyImgDatabase extends Dexie {
    files!: EntityTable<FileEntry, 'key'>

    constructor(dbName = 'tinyimg-db') {
      super(dbName)
      this.version(1).stores({
        files: 'key',
      })
    }
  }

  const db = new TinyImgDatabase(dbName)
  db.open().catch((error) => console.error('[DexieAdapter] db.open failed', error))

  const adapter: StorageAdapter = {
    async clear(): Promise<void> {
      await db.files.clear()
    },

    async delete(key: string): Promise<void> {
      await db.files.delete(key)
    },

    async deleteByPrefix(prefix: string): Promise<number> {
      const collection = db.files.where('key').startsWith(prefix)
      const count = await collection.count()
      await collection.delete()
      return count
    },

    async get(key: string): Promise<ArrayBuffer | null> {
      const entry = await db.files.get(key)
      if (!entry) return null
      if (entry.data instanceof ArrayBuffer) return entry.data
      return await entry.data.arrayBuffer()
    },

    async getBackedFile(key: string): Promise<File | null> {
      const entry = await db.files.get(key)
      if (!entry) return null
      const blob = entry.data instanceof Blob ? entry.data : new Blob([entry.data])
      return new File([blob], key, { type: blob.type })
    },

    async getWritableHandle(key: string): Promise<FileSystemFileHandle> {
      return {
        createWritable: async () => {
          const chunks: BlobPart[] = []
          return {
            abort: async () => {},
            close: async () => {
              const blob = new Blob(chunks)
              await adapter.set(key, await blob.arrayBuffer())
            },
            write: async (data: BlobPart) => {
              chunks.push(data)
            },
          } as unknown as FileSystemWritableFileStream
        },
        getFile: async () => {
          const file = await adapter.getBackedFile(key)
          if (!file) throw new Error('File not found')
          return file
        },
        kind: 'file',
        name: key,
      } as unknown as FileSystemFileHandle
    },

    async has(key: string): Promise<boolean> {
      const count = await db.files.where('key').equals(key).count()
      return count > 0
    },

    async quota(): Promise<QuotaInfo> {
      const e = await navigator.storage?.estimate?.()
      return { quota: e?.quota ?? 0, usage: e?.usage ?? 0 }
    },

    async set(key: string, data: ArrayBuffer): Promise<void> {
      await db.files.put({ data, key })
    },
  }
  return adapter
}
