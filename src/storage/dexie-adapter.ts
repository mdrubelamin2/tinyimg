import { Dexie, type EntityTable } from 'dexie'

import type { QuotaInfo, StorageAdapter } from '@/storage/storage-adapter'

interface FileEntry {
  data: ArrayBuffer | Blob
  key: string
  /** Scope prefix for O(log n) grouped deletes (e.g. out:itemId). */
  scope: string
}

export function createDexieAdapter(dbName?: string): StorageAdapter {
  class TinyImgDatabase extends Dexie {
    files!: EntityTable<FileEntry, 'key'>

    constructor(dbName = 'tinyimg-db') {
      super(dbName)
      this.version(1).stores({
        files: 'key',
      })
      this.version(2)
        .stores({
          files: 'key, scope',
        })
        .upgrade(async (tx) => {
          await tx
            .table('files')
            .toCollection()
            .modify((entry: FileEntry) => {
              entry.scope = scopeForKey(entry.key)
            })
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
      const scope = prefix.endsWith(':') ? prefix.slice(0, -1) : prefix
      return db.files.where('scope').equals(scope).delete()
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
              const ab = await blob.arrayBuffer()
              await db.files.put({ data: ab, key, scope: scopeForKey(key) })
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
      const entry = await db.files.get(key)
      return entry !== undefined
    },

    async quota(): Promise<QuotaInfo> {
      const e = await navigator.storage?.estimate?.()
      return { quota: e?.quota ?? 0, usage: e?.usage ?? 0 }
    },

    async set(key: string, data: ArrayBuffer): Promise<void> {
      await db.files.put({ data, key, scope: scopeForKey(key) })
    },
  }
  return adapter
}

function scopeForKey(key: string): string {
  if (key.startsWith('out:')) {
    const parts = key.split(':')
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`
  }
  return key
}
