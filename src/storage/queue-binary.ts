/**
 * Queue payload keys + read/write helpers for **session hybrid binary storage**
 * (`getSessionBinaryStorage`: NFSA native OPFS → IndexedDB → memory).
 *
 * - **Direct-drop originals** live in `dropped-original-files.ts` (in-memory map) — no duplicate hybrid `set()` for those.
 * - **Buffered sources** (ZIP entries, folder traversal, etc.) are written here via `persistBufferedOriginalSource`.
 * - **Encoded outputs** use {@link persistEncodedOutput} (bytes only; object URLs are created lazily on download/preview).
 */

import type { ImageItem } from '@/lib/queue/types'

import { mimeForOutputFormat } from '@/constants'
import { peekDirectDropOriginal } from '@/storage/dropped-original-files'
import { getSessionBinaryStorage } from '@/storage/hybrid-storage'
import { outKey, outKeyPrefix, srcKey } from '@/storage/keys'

export { outKey as outputStorageKey, srcKey as sourceStorageKey } from '@/storage/keys'

/** Short-lived object URL for a stored output; caller must {@link URL.revokeObjectURL}. */
export async function createTransientObjectUrlForPayloadKey(
  payloadKey: string,
  mimeHint: string,
): Promise<string> {
  const storage = await getSessionBinaryStorage()
  return createObjectUrlForStoredPayload(storage, payloadKey, mimeHint)
}

export async function deleteItemPayloads(id: string): Promise<void> {
  const storage = await getSessionBinaryStorage()
  const sk = srcKey(id)
  if (await storage.has(sk)) {
    await storage.delete(sk)
  }
  await storage.deleteByPrefix(outKeyPrefix(id))
}

export async function deleteOutputPayloadKey(key: string | undefined): Promise<void> {
  if (!key) return
  const storage = await getSessionBinaryStorage()
  await storage.delete(key)
}

/** Persist ZIP / synthetic `File` originals into the hybrid session store. */
export async function persistBufferedOriginalSource(itemId: string, file: File): Promise<void> {
  const storage = await getSessionBinaryStorage()
  await storage.set(srcKey(itemId), await file.arrayBuffer())
}

/**
 * Persist encoded output bytes only (no eager `blob:` URL). Callers create object URLs on demand.
 */
export async function persistEncodedOutput(
  id: string,
  resultId: string,
  data: ArrayBuffer,
  mimeHint: string,
): Promise<{ payloadKey: string }> {
  void mimeHint
  const storage = await getSessionBinaryStorage()
  const payloadKey = outKey(id, resultId)
  await storage.set(payloadKey, data)
  return { payloadKey }
}

/** @deprecated Prefer {@link persistEncodedOutput}; reads full blob on caller thread. */
export async function persistOutputBlob(
  id: string,
  resultId: string,
  blob: Blob,
  mimeFormat: string,
): Promise<{ payloadKey: string }> {
  return persistEncodedOutput(
    id,
    resultId,
    await blob.arrayBuffer(),
    blob.type || mimeForOutputFormat(mimeFormat),
  )
}

/**
 * Worker / thumbnail source resolution:
 * 1. Direct-drop map (stable `File`, never copied into hybrid `src:`).
 * 2. Hybrid session `src:${id}` when present (must be awaited after {@link persistBufferedOriginalSource} in add-files).
 */
export async function resolveOriginalSourceFile(
  itemId: string,
  item: ImageItem,
): Promise<File | null> {
  const fromDrop = peekDirectDropOriginal(itemId)
  if (fromDrop) return fromDrop

  const storage = await getSessionBinaryStorage()
  const sk = srcKey(itemId)
  if (await storage.has(sk)) {
    const fromStore = await loadSourceFileFromStorageOnly(itemId, item)
    if (fromStore) return fromStore
  }

  return null
}

async function createObjectUrlForStoredPayload(
  storage: Awaited<ReturnType<typeof getSessionBinaryStorage>>,
  payloadKey: string,
  mimeHint: string,
): Promise<string> {
  const f = await storage.getBackedFile(payloadKey)
  if (f) {
    return URL.createObjectURL(f)
  }
  const ab = await storage.get(payloadKey)
  if (!ab) return ''
  return URL.createObjectURL(new Blob([ab], { type: mimeHint || 'application/octet-stream' }))
}

function guessNameMime(item: ImageItem, itemId: string): { mime: string; name: string } {
  const ext = item.originalFormat || 'bin'
  return {
    mime: item.mimeType || (ext === 'unknown' ? 'application/octet-stream' : `image/${ext}`),
    name: item.fileName || `queue-${itemId}.${ext}`,
  }
}

async function loadSourceFileFromStorageOnly(
  itemId: string,
  item: ImageItem,
): Promise<File | null> {
  const key = srcKey(itemId)
  const storage = await getSessionBinaryStorage()
  const backed = await storage.getBackedFile(key)
  const { mime, name } = guessNameMime(item, itemId)
  if (backed) {
    return new File([backed], name, {
      lastModified: backed.lastModified,
      type: mime,
    })
  }
  const ab = await storage.get(key)
  if (!ab) return null
  return new File([ab], name, { type: mime })
}
