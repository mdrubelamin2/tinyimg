/**
 * Ephemeral session binary storage (cleared on mount and unmount).
 * Unified NFSA-backed store (native OPFS → NFSA IndexedDB → NFSA memory).
 */

export interface QuotaInfo {
  usage: number;
  quota: number;
}

export interface StorageAdapter {
  set(key: string, data: ArrayBuffer): Promise<void>;
  get(key: string): Promise<ArrayBuffer | null>;
  /** File-backed read without copying the full payload into a JS ArrayBuffer when the backend supports it. */
  getBackedFile(key: string): Promise<File | null>;
  /** For streaming writes (e.g. ZIP); same namespace as other keys. */
  getWritableHandle(key: string): Promise<FileSystemFileHandle>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<number>;
  has(key: string): Promise<boolean>;
  quota(): Promise<QuotaInfo>;
  clear(): Promise<void>;
}
