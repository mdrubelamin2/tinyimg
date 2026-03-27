/**
 * Download helpers: build ZIP from queue items and trigger download; revoke object URLs.
 * Single responsibility: blob/URL lifecycle for batch download and cleanup.
 */

import {
  MAX_DOWNLOAD_FILES,
  MAX_DOWNLOAD_BYTES,
  DOWNLOAD_URL_REVOKE_DELAY_MS,
  STATUS_SUCCESS,
} from '../constants';
import type { ImageItem, ImageResult } from './queue-types';

const ZIP_MIME = 'application/zip';

/**
 * Revoke all object URLs for an item's results. Call when replacing or removing an item.
 * @param item - Queue item whose result download URLs should be revoked
 */
export function revokeResultUrls(item: ImageItem): void {
  Object.values(item.results).forEach((r: ImageResult) => {
    if (r.downloadUrl) {
      URL.revokeObjectURL(r.downloadUrl);
    }
  });
}

/** Revoke all result URLs for multiple items. */
export function revokeResultUrlsForItems(items: ImageItem[]): void {
  items.forEach(revokeResultUrls);
}

/**
 * Build a ZIP from successful results in items (respecting max files and bytes),
 * trigger download, and revoke the blob URL after a delay.
 * @param items - Queue items; only results with status success and blob are included
 */
export async function buildAndDownloadZip(items: ImageItem[]): Promise<void> {
  const { zip } = await import('fflate');
  const zipData: Record<string, Uint8Array> = {};
  let fileCount = 0;
  let totalBytes = 0;

  function uniqueZipPath(baseName: string, ext: string): string {
    let candidate = `tinyimg-${baseName}.${ext}`;
    let n = 1;
    while (candidate in zipData) {
      n++;
      candidate = `tinyimg-${baseName}-${n}.${ext}`;
    }
    return candidate;
  }

  for (const item of items) {
    if (fileCount >= MAX_DOWNLOAD_FILES) break;
    for (const result of Object.values(item.results)) {
      if (fileCount >= MAX_DOWNLOAD_FILES || totalBytes >= MAX_DOWNLOAD_BYTES) break;
      if (result.status === STATUS_SUCCESS && result.blob) {
        const buffer = await result.blob.arrayBuffer();
        const size = buffer.byteLength;
        if (totalBytes + size > MAX_DOWNLOAD_BYTES) continue;
        const baseName = item.file.name.substring(0, item.file.name.lastIndexOf('.'));
        const ext = result.format === 'jpeg' ? 'jpg' : result.format;
        const path = uniqueZipPath(baseName, ext);
        zipData[path] = new Uint8Array(buffer);
        fileCount++;
        totalBytes += size;
      }
    }
  }

  if (Object.keys(zipData).length === 0) return;

  zip(zipData, (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    const blob = new Blob([data as unknown as BlobPart], { type: ZIP_MIME });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tinyimg-batch-${Date.now()}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_REVOKE_DELAY_MS);
  });
}
