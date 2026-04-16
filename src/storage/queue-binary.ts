/**
 * Queue payload keys + read/write helpers for **session hybrid binary storage**
 * (`getSessionBinaryStorage`: OPFS when available, else IndexedDB, else in-memory for tests).
 *
 * - **Direct-drop originals** live in `dropped-original-files.ts` (in-memory map) — no duplicate hybrid `set()` for those.
 * - **Buffered sources** (ZIP entries, folder traversal, etc.) are written here via `persistBufferedOriginalSource`.
 * - **Encoded outputs** use `persistOutputBlob` / `persistOutputBytes` (same adapter chain).
 *
 * `getBackedFile` on the adapter is an optional OPFS optimization for object URLs; IDB path uses `get` + `Blob`.
 */

import { mimeForOutputFormat } from '@/constants';
import { getSessionBinaryStorage } from '@/storage/hybrid-storage';
import type { ImageItem } from '@/lib/queue/types';
import { peekDirectDropOriginal } from '@/storage/dropped-original-files';

export function sourceStorageKey(id: string): string {
  return `src:${id}`;
}

export function outputStorageKey(id: string, format: string): string {
  return `out:${id}:${format}`;
}

function outputKeyPrefix(id: string): string {
  return `out:${id}:`;
}

/** Persist ZIP / synthetic `File` originals into the hybrid session store (OPFS → IDB → memory). */
export async function persistBufferedOriginalSource(itemId: string, file: File): Promise<void> {
  const storage = await getSessionBinaryStorage();
  await storage.set(sourceStorageKey(itemId), await file.arrayBuffer());
}

/**
 * Worker / thumbnail source resolution:
 * 1. Direct-drop map (stable `File`, never copied into hybrid `src:`).
 * 2. Hybrid session `src:${id}` when present (must be awaited after {@link persistBufferedOriginalSource} in add-files).
 */
export async function resolveOriginalSourceFile(itemId: string, item: ImageItem): Promise<File | null> {
  const fromDrop = peekDirectDropOriginal(itemId);
  if (fromDrop) return fromDrop;

  const storage = await getSessionBinaryStorage();
  const srcKey = sourceStorageKey(itemId);
  if (await storage.has(srcKey)) {
    const fromStore = await loadSourceFileFromStorageOnly(itemId, item);
    if (fromStore) return fromStore;
  }

  return null;
}

function guessNameMime(item: ImageItem, itemId: string): { name: string; mime: string } {
  const ext = item.originalFormat || 'bin';
  return {
    name: item.fileName || `queue-${itemId}.${ext}`,
    mime: item.mimeType || (ext === 'unknown' ? 'application/octet-stream' : `image/${ext}`),
  };
}

async function loadSourceFileFromStorageOnly(itemId: string, item: ImageItem): Promise<File | null> {
  const key = sourceStorageKey(itemId);
  const storage = await getSessionBinaryStorage();
  const backed = await storage.getBackedFile?.(key);
  const { name, mime } = guessNameMime(item, itemId);
  if (backed) {
    return new File([backed], name, { type: mime, lastModified: backed.lastModified });
  }
  const ab = await storage.get(key);
  if (!ab) return null;
  return new File([ab], name, { type: mime });
}

export async function persistOutputBytes(
  id: string,
  format: string,
  data: ArrayBuffer,
  mimeHint: string
): Promise<{ payloadKey: string; downloadUrl: string }> {
  const storage = await getSessionBinaryStorage();
  const payloadKey = outputStorageKey(id, format);
  await storage.set(payloadKey, data);
  const url = await createObjectUrlForStoredPayload(storage, payloadKey, mimeHint);
  return { payloadKey, downloadUrl: url };
}

export async function persistOutputBlob(
  id: string,
  format: string,
  blob: Blob
): Promise<{ payloadKey: string; downloadUrl: string }> {
  return persistOutputBytes(id, format, await blob.arrayBuffer(), blob.type || mimeForOutputFormat(format));
}

async function createObjectUrlForStoredPayload(
  storage: Awaited<ReturnType<typeof getSessionBinaryStorage>>,
  payloadKey: string,
  mimeHint: string
): Promise<string> {
  const f = await storage.getBackedFile?.(payloadKey);
  if (f) {
    return URL.createObjectURL(f);
  }
  const ab = await storage.get(payloadKey);
  if (!ab) return '';
  return URL.createObjectURL(new Blob([ab], { type: mimeHint || 'application/octet-stream' }));
}

export async function deleteItemPayloads(id: string): Promise<void> {
  const storage = await getSessionBinaryStorage();
  const sk = sourceStorageKey(id);
  if (await storage.has(sk)) {
    await storage.delete(sk);
  }
  await storage.deleteByPrefix(outputKeyPrefix(id));
}

export async function deleteOutputPayloadKey(key: string | undefined): Promise<void> {
  if (!key) return;
  const storage = await getSessionBinaryStorage();
  await storage.delete(key);
}
