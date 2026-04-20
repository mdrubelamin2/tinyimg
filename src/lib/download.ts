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
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';
import { ensureZipJsConfigured } from '@/lib/zip-js-config';

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

export function revokeResultUrlsForItems(items: ImageItem[]): void {
  items.forEach(revokeResultUrls);
}

export async function downloadStoredOutput(
  payloadKey: string,
  format: string,
  downloadFilename: string
): Promise<void> {
  const mime = mimeForOutputFormat(format);
  const storage = await getSessionBinaryStorage();
  const backed = await storage.getBackedFile(payloadKey);
  const raw = backed ? null : await storage.get(payloadKey);
  if (!backed && !raw) return;

  const url = await createTransientObjectUrlForPayloadKey(payloadKey, mime);
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

export async function buildAndDownloadZip(items: ImageItem[]): Promise<void> {
  ensureZipJsConfigured();
  const storage = await getSessionBinaryStorage();
  const ts = Date.now();
  const zipDisplayName = `tinyimg-batch-${ts}.zip`;

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

  const zipWriter = new ZipWriter(new BlobWriter('application/zip'), {
    bufferedWrite: true,
    useWebWorkers: false
  });

  try {
    for (const item of items) {
      if (fileCount >= MAX_DOWNLOAD_FILES) break;
      const results = Object.values(item.results);
      for (const result of results) {
        if (fileCount >= MAX_DOWNLOAD_FILES || totalBytes >= MAX_DOWNLOAD_BYTES) break;
        if (result.status === STATUS_SUCCESS && result.payloadKey) {
          const dot = item.fileName.lastIndexOf('.');
          const baseName = dot > 0 ? item.fileName.substring(0, dot) : item.fileName;
          const ext = result.format === 'jpeg' ? 'jpg' : result.format;
          const fullName = buildOptimizedDownloadFilename(baseName, result);
          const zipStem = fullName.replace(/^tinyimg-/, '').replace(/\.[^.]+$/, '');
          const path = uniqueZipPath(zipStem, ext);

          const backed = await storage.getBackedFile(result.payloadKey);
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
      const finalBlob = await zipWriter.close();
      if (!finalBlob || finalBlob.size === 0) {
        throw new Error('Generated ZIP is empty');
      }

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipDisplayName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, DOWNLOAD_URL_REVOKE_DELAY_MS);
    } else {
      await zipWriter.close().catch(() => {});
    }
  } catch (e) {
    await zipWriter.close().catch(() => {});
    throw e;
  }
}
