/**
 * Ephemeral session binary storage (cleared on mount and unmount).
 * Unified NFSA-backed store (native OPFS → NFSA IndexedDB → NFSA memory).
 */

export interface QuotaInfo {
  quota: number
  usage: number
}

export interface StorageAdapter {
  clear(): Promise<void>
  delete(key: string): Promise<void>
  deleteByPrefix(prefix: string): Promise<number>
  get(key: string): Promise<ArrayBuffer | null>
  /** File-backed read without copying the full payload into a JS ArrayBuffer when the backend supports it. */
  getBackedFile(key: string): Promise<File | null>
  /** For streaming writes (e.g. ZIP); same namespace as other keys. */
  getWritableHandle(key: string): Promise<FileSystemFileHandle>
  has(key: string): Promise<boolean>
  quota(): Promise<QuotaInfo>
  set(key: string, data: ArrayBuffer): Promise<void>
}
