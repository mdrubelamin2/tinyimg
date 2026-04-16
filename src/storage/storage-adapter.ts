/**
 * Ephemeral session binary storage (cleared on mount and unmount).
 * OPFS when available; IndexedDB fallback for Firefox/Safari gaps.
 */

export interface QuotaInfo {
  usage: number;
  quota: number;
}

export interface StorageAdapter {
  set(key: string, data: ArrayBuffer): Promise<void>;
  get(key: string): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<number>;
  has(key: string): Promise<boolean>;
  quota(): Promise<QuotaInfo>;
  clear(): Promise<void>;
  /**
   * OPFS-backed file without copying the full payload into a JS ArrayBuffer.
   * Used for `URL.createObjectURL` on large outputs. Optional (e.g. IDB adapter omits).
   */
  getBackedFile?(key: string): Promise<File | null>;
}
