import {
  STATUS_SUCCESS,
  DOWNLOAD_URL_REVOKE_DELAY_MS,
  mimeForOutputFormat,
} from '@/constants';
import type { ImageItem, ImageResult } from './queue/types';
import { buildOptimizedDownloadFilename } from '@/lib/result-download-name';
import { getSessionBinaryStorage } from '@/storage/hybrid-storage';
import { createTransientObjectUrlForPayloadKey, deleteOutputPayloadKey } from '@/storage/queue-binary';
import { nanoid } from 'nanoid';

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
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
    alert("Service worker is initializing. Please try again in a few seconds.");
    return;
  }

  const storage = await getSessionBinaryStorage();

  const ts = Date.now();
  const zipDisplayName = `tinyimg-batch-${ts}.zip`;
  const batchId = nanoid();
  const manifest: { path: string; payloadKey: string }[] = [];
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

  for (const item of items) {
    const results = Object.values(item.results);

    for (const result of results) {
      if (result.status === STATUS_SUCCESS && result.payloadKey) {
        const dot = item.fileName.lastIndexOf('.');
        const baseName = dot > 0 ? item.fileName.substring(0, dot) : item.fileName;
        const ext = result.format === 'jpeg' ? 'jpg' : result.format;
        const fullName = buildOptimizedDownloadFilename(baseName, result);
        const zipStem = fullName.replace(/^tinyimg-/, '').replace(/\.[^.]+$/, '');
        const path = uniqueZipPath(zipStem, ext);

        const exists = await storage.has(result.payloadKey);
        if (!exists) {
          console.warn(`[Main] ⚠️ PayloadKey not found in storage: ${result.payloadKey}`);
        }

        manifest.push({ path, payloadKey: result.payloadKey });
      }
    }
  }

  const sw = await navigator.serviceWorker.ready;

  // Send the manifest to the Service Worker's memory map and wait for acknowledgment
  if (!sw.active) {
    console.error('[Main] No active service worker');
    return;
  }

  // Use MessageChannel to get acknowledgment
  const messageChannel = new MessageChannel();
  const manifestReadyPromise = new Promise<void>((resolve) => {
    messageChannel.port1.onmessage = (event) => {
      if (event.data.type === 'MANIFEST_READY' && event.data.batchId === batchId) {
        resolve();
      }
    };
  });

  sw.active.postMessage({
    type: 'PREPARE_ZIP_STREAM',
    batchId,
    manifest
  }, [messageChannel.port2]);

  // Wait for SW to acknowledge
  await manifestReadyPromise;

  // 3. Trigger download via navigation (so SW can intercept and stream directly)
  // Using iframe to avoid page navigation while still triggering SW fetch
  const downloadUrl = `/_/download-zip/${batchId}/${zipDisplayName}`;

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = downloadUrl;
  document.body.appendChild(iframe);

  // Clean up iframe after download starts
  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 5000);
}
