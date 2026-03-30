import {
  MAX_FILE_SIZE_BYTES,
  MAX_ZIP_FILE_SIZE_BYTES,
  MAX_ZIP_EXTRACTED_FILES,
  MAX_ZIP_EXTRACTED_TOTAL_BYTES,
  ERR_FILE_EXCEEDS_LIMIT,
  ERR_ZIP_EXCEEDS_LIMIT,
  ERR_INVALID_FILE,
  ERR_HEIC_BROWSER,
  isValidImageExtension,
} from '../../constants/index.js';
import {
  checkMagicBytes,
  checkMagicBytesFromBufferExport,
  getMimeType,
  DEFAULT_MIME,
  isHeicDecodeLikelySupported,
} from '../validation';
import type { ImageItem, OPFSFileMetadata } from './types';
import { opfsManager } from '../opfs/opfs-manager';

const ZIP_PATH_IGNORE = '__MACOSX';

interface StreamingIntakeContext {
  createItem: (metadata: OPFSFileMetadata) => ImageItem;
}

function isDataTransferItemArray(
  files: File[] | DataTransferItem[]
): files is DataTransferItem[] {
  return files.length > 0 && 'getAsFile' in files[0]!;
}

function createErrorItem(
  file: File,
  error: string,
  createItem: StreamingIntakeContext['createItem']
): ImageItem {
  const metadata: OPFSFileMetadata = {
    id: Math.random().toString(36).substring(2, 12),
    handle: null as unknown as FileSystemFileHandle,
    name: file.name,
    size: file.size,
    type: file.type,
  };
  const item = createItem(metadata);
  item.status = 'error';
  item.error = error;
  return item;
}

async function createValidatedItem(
  file: File,
  createItem: StreamingIntakeContext['createItem']
): Promise<ImageItem | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!isValidImageExtension(ext)) return null;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return createErrorItem(file, ERR_FILE_EXCEEDS_LIMIT, createItem);
  }
  const magicOk = await checkMagicBytes(file, ext);
  if (!magicOk) {
    return createErrorItem(file, ERR_INVALID_FILE, createItem);
  }
  if ((ext === 'heic' || ext === 'heif') && !isHeicDecodeLikelySupported()) {
    return createErrorItem(file, ERR_HEIC_BROWSER, createItem);
  }
  await opfsManager.initialize();
  const id = Math.random().toString(36).substring(2, 12);
  const handle = await opfsManager.writeFile(file, id);
  const metadata: OPFSFileMetadata = {
    id,
    handle,
    name: file.name,
    size: file.size,
    type: file.type,
  };
  return createItem(metadata);
}

async function traverseEntry(
  entry: FileSystemEntry,
  items: ImageItem[],
  ctx: StreamingIntakeContext,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve) =>
      (entry as FileSystemFileEntry).file(resolve)
    );
    if (file.name.endsWith('.zip')) {
      if (file.size > MAX_ZIP_FILE_SIZE_BYTES) {
        items.push(createErrorItem(file, ERR_ZIP_EXCEEDS_LIMIT, ctx.createItem));
        return;
      }
      try {
        const zipItems = await collectItemsFromZip(file, ctx, onProgress);
        items.push(...zipItems);
      } catch (err) {
        items.push(
          createErrorItem(file, 'ZIP extraction failed: ' + String(err), ctx.createItem)
        );
      }
      return;
    }
    const validated = await createValidatedItem(file, ctx.createItem);
    if (validated) {
      items.push(validated);
      onProgress?.(items.length, items.length);
    }
    return;
  }
  if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve) =>
        dirReader.readEntries(resolve)
      );
      if (batch.length === 0) break;
      for (const childEntry of batch) {
        await traverseEntry(childEntry, items, ctx, onProgress);
      }
    }
  }
}

export async function collectItemsFromFilesStreaming(
  files: FileList | File[] | DataTransferItemList | DataTransferItem[],
  ctx: StreamingIntakeContext,
  onProgress?: (current: number, total: number) => void
): Promise<ImageItem[]> {
  const items: ImageItem[] = [];
  await opfsManager.initialize();
  if (
    files instanceof DataTransferItemList ||
    (Array.isArray(files) && isDataTransferItemArray(files))
  ) {
    const droppedPayloads = Array.from(files as ArrayLike<DataTransferItem>).map(
      (item) => {
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
      }
    );
    for (const payload of droppedPayloads) {
      if (!payload) continue;
      if ('entry' in payload) {
        await traverseEntry(payload.entry, items, ctx, onProgress);
        continue;
      }
      const validated = await createValidatedItem(payload.file, ctx.createItem);
      if (validated) {
        items.push(validated);
        onProgress?.(items.length, items.length);
      }
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
        const zipItems = await collectItemsFromZip(file, ctx, onProgress);
        items.push(...zipItems);
      } catch (err) {
        items.push(
          createErrorItem(file, 'ZIP extraction failed: ' + String(err), ctx.createItem)
        );
      }
      continue;
    }
    const validated = await createValidatedItem(file, ctx.createItem);
    if (validated) {
      items.push(validated);
      onProgress?.(items.length, items.length);
    }
  }
  return items;
}

export async function collectItemsFromZip(
  file: File,
  ctx: StreamingIntakeContext,
  onProgress?: (current: number, total: number) => void
): Promise<ImageItem[]> {
  const { unzip } = await import('fflate');
  return new Promise((resolve, reject) => {
    const items: ImageItem[] = [];
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      unzip(data, async (err, unzipped) => {
        if (err) {
          reject(err);
          return;
        }
        let extractedCount = 0;
        let extractedBytes = 0;
        const entries = Object.entries(unzipped);
        for (let i = 0; i < entries.length; i++) {
          const [path, bytes] = entries[i]!;
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
          if (bytes.length === 0 || path.includes(ZIP_PATH_IGNORE)) continue;
          const fileName = path.split('/').pop() ?? 'unnamed';
          if (bytes.length > MAX_FILE_SIZE_BYTES) {
            const oversized = new File([new Uint8Array(0)], fileName, {
              type: getMimeType(fileName),
            });
            items.push(createErrorItem(oversized, ERR_FILE_EXCEEDS_LIMIT, ctx.createItem));
            continue;
          }
          const ext = (fileName.split('.').pop() ?? '').toLowerCase();
          if (getMimeType(fileName) === DEFAULT_MIME) continue;
          const bytesArr =
            bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);
          if (!checkMagicBytesFromBufferExport(bytesArr, ext)) {
            const invalid = new File([new Uint8Array(0)], fileName, {
              type: getMimeType(fileName),
            });
            items.push(createErrorItem(invalid, ERR_INVALID_FILE, ctx.createItem));
            continue;
          }
          const validFile = new File([bytes as unknown as BlobPart], fileName, {
            type: getMimeType(fileName),
          });
          await opfsManager.initialize();
          const id = Math.random().toString(36).substring(2, 12);
          const handle = await opfsManager.writeFile(validFile, id);
          const metadata: OPFSFileMetadata = {
            id,
            handle,
            name: fileName,
            size: validFile.size,
            type: validFile.type,
          };
          items.push(ctx.createItem(metadata));
          onProgress?.(items.length, entries.length);
        }
        resolve(items);
      });
    };
    reader.readAsArrayBuffer(file);
  });
}