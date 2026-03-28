/**
 * Download helpers: Stream ZIP generation to Origin Private File System (OPFS)
 * Zero-Memory footprint for massive batch downloads.
 */

import {
  MAX_DOWNLOAD_FILES,
  MAX_DOWNLOAD_BYTES,
  STATUS_SUCCESS,
} from '../constants/index';
import type { ImageItem, ImageResult } from './queue/types';

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
 * Build a ZIP from successful results in items via Streams, written to disk,
 * then prompt the user to download it. Prevents RAM OOM crashes on huge queues.
 * @param items - Queue items; only results with status success and blob are included
 */
export async function buildAndDownloadZip(items: ImageItem[]): Promise<void> {
  const { Zip, ZipPassThrough } = await import('fflate');
  
  let fileCount = 0;
  let totalBytes = 0;
  const processedPaths = new Set<string>();

  function uniqueZipPath(baseName: string, ext: string): string {
    let candidate = `tinyimg-${baseName}.${ext}`;
    let n = 1;
    while (processedPaths.has(candidate)) {
      n++;
      candidate = `tinyimg-${baseName}-${n}.${ext}`;
    }
    processedPaths.add(candidate);
    return candidate;
  }

  // 1. Prepare OPFS
  const root = await navigator.storage.getDirectory();
  const zipFileName = `tinyimg-batch-${Date.now()}.zip`;
  const fileHandle = await root.getFileHandle(zipFileName, { create: true });
  const writable = await fileHandle.createWritable();
  
  // 2. Create the streaming ZIP compressor
  const zip = new Zip((err, data, final) => {
    if (err) {
      console.error('ZIP Error:', err);
      return;
    }
    
    // Convert Uint8Array to chunk and write to disk immediately (flushes RAM)
    writable.write(data as unknown as Uint8Array<ArrayBuffer>).then(() => {
      if (final) {
        writable.close().then(async () => {
          // 3. When finished writing to OPFS, trigger the download via a virtual link
          const finalFile = await fileHandle.getFile();
          const url = URL.createObjectURL(finalFile);
          const a = document.createElement('a');
          a.href = url;
          a.download = zipFileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // Cleanup OPFS and URL
          setTimeout(() => {
            URL.revokeObjectURL(url);
            root.removeEntry(zipFileName).catch(console.error);
          }, 10000);
        });
      }
    });
  });

  // 3. Stream each file into the ZIP asynchronously
  for (const item of items) {
    if (fileCount >= MAX_DOWNLOAD_FILES) break;
    for (const result of Object.values(item.results)) {
      if (fileCount >= MAX_DOWNLOAD_FILES || totalBytes >= MAX_DOWNLOAD_BYTES) break;
      if (result.status === STATUS_SUCCESS && result.blob) {
        const size = result.blob.size;
        if (totalBytes + size > MAX_DOWNLOAD_BYTES) continue;
        
        const baseName = item.file.name.substring(0, item.file.name.lastIndexOf('.'));
        const ext = result.format === 'jpeg' ? 'jpg' : result.format;
        const path = uniqueZipPath(baseName, ext);
        
        // Create an uncompressed passthrough stream for this file inside the zip
        const fileStream = new ZipPassThrough(path);
        zip.add(fileStream);
        
        // Read file arrayBuffer and push to fflate Stream
        const buffer = await result.blob.arrayBuffer();
        fileStream.push(new Uint8Array(buffer), true);
        
        fileCount++;
        totalBytes += size;
      }
    }
  }

  // Signal the zip stream to finish
  if (fileCount > 0) {
    zip.end();
  } else {
    // If no files, abort and clean up
    await writable.close();
    await root.removeEntry(zipFileName);
  }
}
