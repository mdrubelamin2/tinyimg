/**
 * Download helpers: stream ZIP to Origin Private File System (OPFS), then trigger save.
 * Uses zip.js so entries are written sequentially without holding the whole archive in RAM.
 */

import {
  MAX_DOWNLOAD_FILES,
  MAX_DOWNLOAD_BYTES,
  STATUS_SUCCESS,
  DOWNLOAD_URL_REVOKE_DELAY_MS,
  mimeForOutputFormat,
} from '@/constants';
import type { ImageItem, ImageResult } from './queue/types';
import { buildOptimizedDownloadFilename } from '@/lib/result-download-name';
import { getSessionBinaryStorage } from '@/storage/hybrid-storage';
import { createTransientObjectUrlForPayloadKey, deleteOutputPayloadKey } from '@/storage/queue-binary';
import { BlobReader, ZipWriter } from '@zip.js/zip.js';
import { ensureZipJsConfigured } from '@/lib/zip-js-config';

/**
 * Revoke all object URLs for an item's results. Call when replacing or removing an item.
 * @param item - Queue item whose result download URLs should be revoked
 */
export function revokeResultUrls(item: ImageItem): void {
  Object.values(item.results).forEach((r: ImageResult) => {
    if (r.downloadUrl) {
      URL.revokeObjectURL(r.downloadUrl);
    }
    if (r.payloadKey) {
      void deleteOutputPayloadKey(r.payloadKey);
    }
  });
}

/** Revoke all result URLs for multiple items. */
export function revokeResultUrlsForItems(items: ImageItem[]): void {
  items.forEach(revokeResultUrls);
}

/**
 * Trigger a one-shot browser download for bytes stored under `payloadKey`.
 * Creates a short-lived object URL and revokes it after {@link DOWNLOAD_URL_REVOKE_DELAY_MS}.
 */
export async function downloadStoredOutput(
  payloadKey: string,
  format: string,
  downloadFilename: string
): Promise<void> {
  const url = await createTransientObjectUrlForPayloadKey(payloadKey, mimeForOutputFormat(format));
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, DOWNLOAD_URL_REVOKE_DELAY_MS);
}

/**
 * Build a ZIP from successful results in items, stream to OPFS, then prompt download.
 * @param items - Queue items; only results with status success and a stored payload key are included
 */
export async function buildAndDownloadZip(items: ImageItem[]): Promise<void> {
  ensureZipJsConfigured();
  const storage = await getSessionBinaryStorage();
  let fileCount = 0;
  let totalBytes = 0;
  const processedPaths = new Set<string>();

  function uniqueZipPath(fullBase: string, ext: string): string {
    let candidate = `tinyimg-${fullBase}.${ext}`;
    let n = 1;
    while (processedPaths.has(candidate)) {
      n++;
      candidate = `tinyimg-${fullBase}-${n}.${ext}`;
    }
    processedPaths.add(candidate);
    return candidate;
  }

  const root = await navigator.storage.getDirectory();
  const zipFileName = `tinyimg-batch-${Date.now()}.zip`;
  const fileHandle = await root.getFileHandle(zipFileName, { create: true });
  const writable = await fileHandle.createWritable();
  const zipWriter = new ZipWriter(writable);

  try {
    for (const item of items) {
      if (fileCount >= MAX_DOWNLOAD_FILES) break;
      for (const result of Object.values(item.results)) {
        if (fileCount >= MAX_DOWNLOAD_FILES || totalBytes >= MAX_DOWNLOAD_BYTES) break;
        if (result.status === STATUS_SUCCESS && result.payloadKey) {
          const dot = item.fileName.lastIndexOf('.');
          const baseName = dot > 0 ? item.fileName.substring(0, dot) : item.fileName;
          const ext = result.format === 'jpeg' ? 'jpg' : result.format;
          const fullName = buildOptimizedDownloadFilename(baseName, result);
          const zipStem = fullName.replace(/^tinyimg-/, '').replace(/\.[^.]+$/, '');
          const path = uniqueZipPath(zipStem, ext);

          const backed = await storage.getBackedFile?.(result.payloadKey);
          if (backed) {
            const size = backed.size;
            if (totalBytes + size > MAX_DOWNLOAD_BYTES) continue;
            await zipWriter.add(path, new BlobReader(backed));
            fileCount++;
            totalBytes += size;
            continue;
          }

          const ab = await storage.get(result.payloadKey);
          if (!ab) continue;
          const size = ab.byteLength;
          if (totalBytes + size > MAX_DOWNLOAD_BYTES) continue;

          const blob = new Blob([ab], { type: mimeForOutputFormat(result.format) });
          await zipWriter.add(path, new BlobReader(blob));

          fileCount++;
          totalBytes += size;
        }
      }
    }

    if (fileCount > 0) {
      await zipWriter.close();
      const finalFile = await fileHandle.getFile();
      const url = URL.createObjectURL(finalFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        URL.revokeObjectURL(url);
        root.removeEntry(zipFileName).catch(console.error);
      }, DOWNLOAD_URL_REVOKE_DELAY_MS);
    } else {
      await zipWriter.close().catch(() => {});
      await writable.close().catch(() => {});
      await root.removeEntry(zipFileName).catch(console.error);
    }
  } catch (e) {
    await writable.close().catch(() => {});
    await root.removeEntry(zipFileName).catch(() => {});
    throw e;
  }
}
