import {
  MAX_FILE_SIZE_BYTES,
  MAX_ZIP_FILE_SIZE_BYTES,
  MAX_ZIP_EXTRACTED_FILES,
  MAX_ZIP_EXTRACTED_TOTAL_BYTES,
} from '@/constants/limits';
import {
  ERR_FILE_EXCEEDS_LIMIT,
  ERR_ZIP_EXCEEDS_LIMIT,
  ERR_HEIC_BROWSER,
  isValidImageExtension,
  STATUS_CHECKING,
} from '@/constants';
import {
  getMimeType,
  isHeicDecodeLikelySupported,
} from '@/lib/validation';
import type { ImageItem } from '@/lib/queue/types';
import toast from 'react-hot-toast';
import { yieldToMain } from '@/lib/scheduler-polyfill';

interface IntakeContext {
  createItem: (file: File) => ImageItem;
  onDimensionCheckComplete?: (item: ImageItem, error: string | null) => void;
}

function isDataTransferItemArray(files: File[] | DataTransferItem[]): files is DataTransferItem[] {
  return files.length > 0 && 'getAsFile' in files[0]!;
}

function createErrorItem(
  file: File,
  error: string,
  createItem: IntakeContext['createItem']
): ImageItem {
  const item = createItem(file);
  item.status = 'error';
  item.error = error;
  return item;
}

/**
 * Check image dimensions in a worker to avoid blocking main thread.
 * Calls callback when complete.
 */
function checkImageDimensionsAsync(
  file: File,
  item: ImageItem,
  callback: (item: ImageItem, error: string | null) => void
): void {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'svg') {
    callback(item, null);
    return;
  }

  const worker = new Worker(
    new URL('@/workers/dimension-checker.worker.ts', import.meta.url),
    { type: 'module' }
  );

  const timeoutId = setTimeout(() => {
    worker.terminate();
    callback(item, null); // Timeout - let optimizer worker handle it
  }, 3000);

  worker.onmessage = (e: MessageEvent) => {
    clearTimeout(timeoutId);
    worker.terminate();

    if (e.data.valid) {
      callback(item, null);
    } else {
      callback(item, e.data.error);
    }
  };

  worker.onerror = () => {
    clearTimeout(timeoutId);
    worker.terminate();
    callback(item, null); // Error - let optimizer worker handle it
  };

  worker.postMessage({ file, id: file.name });
}

function createValidatedItem(
  file: File,
  createItem: IntakeContext['createItem'],
  onDimensionCheckComplete?: (item: ImageItem, error: string | null) => void
): ImageItem | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!isValidImageExtension(ext)) return null;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return createErrorItem(file, ERR_FILE_EXCEEDS_LIMIT, createItem);
  }

  if ((ext === 'heic' || ext === 'heif') && !isHeicDecodeLikelySupported()) {
    return createErrorItem(file, ERR_HEIC_BROWSER, createItem);
  }

  // Create item immediately with "checking" status
  const item = createItem(file);
  item.status = STATUS_CHECKING;

  // Start dimension check in background (non-blocking)
  if (onDimensionCheckComplete) {
    checkImageDimensionsAsync(file, item, onDimensionCheckComplete);
  }

  return item;
}

async function traverseEntry(
  entry: FileSystemEntry,
  items: ImageItem[],
  ctx: IntakeContext
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve) =>
      (entry as FileSystemFileEntry).file(resolve)
    );

    // Handle ZIP files dropped via FileSystemEntry
    if (file.name.endsWith('.zip')) {
      if (file.size > MAX_ZIP_FILE_SIZE_BYTES) {
        items.push(createErrorItem(file, ERR_ZIP_EXCEEDS_LIMIT, ctx.createItem));
        return;
      }
      try {
        const toastId = toast.loading(`Extracting ${file.name}...`);
        const zipItems = await collectItemsFromZip(file, ctx);
        items.push(...zipItems);
        toast.success(`Extracted ${zipItems.length} files from ${file.name}`, { id: toastId });
      } catch (err) {
        items.push(createErrorItem(file, 'ZIP extraction failed: ' + String(err), ctx.createItem));
        toast.error(`Failed to extract ${file.name}`);
      }
      return;
    }

    const validated = createValidatedItem(file, ctx.createItem, ctx.onDimensionCheckComplete);
    if (validated) items.push(validated);
    return;
  }

  if (entry.isDirectory) {
    const toastId = toast.loading(`Reading folder: ${entry.name}...`);
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    let fileCount = 0;
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve) =>
        dirReader.readEntries(resolve)
      );
      if (batch.length === 0) break;
      for (const childEntry of batch) {
        await traverseEntry(childEntry, items, ctx);
        fileCount++;

        // Yield to main thread every 10 files to prevent blocking
        if (fileCount % 10 === 0) {
          await yieldToMain();
        }
      }
    }
    toast.success(`Loaded ${fileCount} items from ${entry.name}`, { id: toastId });
  }
}

export async function collectItemsFromFiles(
  files: FileList | File[] | DataTransferItemList | DataTransferItem[],
  ctx: IntakeContext
): Promise<ImageItem[]> {
  const items: ImageItem[] = [];

  if (
    files instanceof DataTransferItemList ||
    (Array.isArray(files) && isDataTransferItemArray(files))
  ) {
    const droppedPayloads = Array.from(files as ArrayLike<DataTransferItem>).map((item) => {
      const entry = (
        item as DataTransferItem & {
          webkitGetAsEntry?: () => FileSystemEntry | null;
        }
      ).webkitGetAsEntry?.() ?? null;

      if (entry) {
        return { entry };
      }

      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          return { file };
        }
      }

      return null;
    });

    for (const payload of droppedPayloads) {
      if (!payload) continue;

      if ('entry' in payload) {
        await traverseEntry(payload.entry, items, ctx);
        continue;
      }

      const validated = await createValidatedItem(payload.file, ctx.createItem);
      if (validated) items.push(validated);
    }
    return items;
  }

  for (const file of Array.from(files)) {
    if (file.name.endsWith('.zip')) {
      if (file.size > MAX_ZIP_FILE_SIZE_BYTES) {
        items.push(createErrorItem(file, ERR_ZIP_EXCEEDS_LIMIT, ctx.createItem));
        continue;
      }

      try {
        const toastId = toast.loading(`Extracting ${file.name}...`);
        const zipItems = await collectItemsFromZip(file, ctx);
        items.push(...zipItems);
        toast.success(`Extracted ${zipItems.length} files from ${file.name}`, { id: toastId });
      } catch (err) {
        items.push(createErrorItem(file, 'ZIP extraction failed: ' + String(err), ctx.createItem));
        toast.error(`Failed to extract ${file.name}`);
      }
      continue;
    }

    const validated = await createValidatedItem(file, ctx.createItem);
    if (validated) items.push(validated);
  }

  return items;
}

export async function collectItemsFromZip(
  file: File,
  ctx: IntakeContext
): Promise<ImageItem[]> {
  // Offload ZIP extraction to worker thread to prevent main thread blocking
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('@/workers/zip-extractor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    const items: ImageItem[] = [];
    let extractedCount = 0;
    let extractedBytes = 0;

    worker.onmessage = (e: MessageEvent) => {
      const { files, error } = e.data;
      worker.terminate();

      if (error) {
        reject(new Error(error));
        return;
      }

      if (!files || files.length === 0) {
        resolve([]);
        return;
      }

      // Process extracted files on main thread (fast - just File object creation)
      for (const { name: fileName, data: bytes } of files) {
        extractedCount += 1;
        extractedBytes += bytes.length;

        if (extractedCount > MAX_ZIP_EXTRACTED_FILES) {
          reject(new Error('ZIP contains too many files'));
          return;
        }
        if (extractedBytes > MAX_ZIP_EXTRACTED_TOTAL_BYTES) {
          reject(new Error('ZIP uncompressed data too large'));
          return;
        }

        if (bytes.length > MAX_FILE_SIZE_BYTES) {
          const oversized = new File([new Uint8Array(0)], fileName, {
            type: getMimeType(fileName),
          });
          items.push(createErrorItem(oversized, ERR_FILE_EXCEEDS_LIMIT, ctx.createItem));
          continue;
        }

        const validFile = new File([bytes as unknown as BlobPart], fileName, {
          type: getMimeType(fileName),
        });
        items.push(ctx.createItem(validFile));
      }

      resolve(items);
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error('ZIP extraction worker failed: ' + err.message));
    };

    // Read file and send to worker
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      worker.postMessage({ data });
    };
    reader.onerror = () => {
      worker.terminate();
      reject(new Error('Failed to read ZIP file'));
    };
    reader.readAsArrayBuffer(file);
  });
}

