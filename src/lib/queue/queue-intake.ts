import {
  ERR_FILE_EXCEEDS_LIMIT,
  ID_RANDOM_LENGTH,
  isValidImageExtension,
  MAX_FILE_SIZE_BYTES,
  MAX_PIXELS,
  MAX_ZIP_EXTRACTED_FILES,
  MAX_ZIP_EXTRACTED_TOTAL_BYTES,
  MAX_ZIP_FILE_SIZE_BYTES,
  STATUS_ERROR,
  ERR_INVALID_FILE,
} from '@/constants';
import type { ImageItem } from '@/lib/queue/types';
import { DEFAULT_MIME, getMimeType, mimeByFormat } from '@/lib/validation';
import { ensureZipJsConfigured } from '@/lib/zip-js-config';
import { getSessionBinaryStorage } from '@/storage/hybrid-storage';
import { srcKey } from '@/storage/keys';
import type { StorageAdapter } from '@/storage/storage-adapter';
import type { Entry, EntryGetDataOptions, FileEntry } from '@zip.js/zip.js';
import { BlobReader, ZipReader } from '@zip.js/zip.js';
import { nanoid } from 'nanoid';
import { imageDimensionsFromStream } from 'image-dimensions';

type FileSystemDirectoryHandleWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

const ZIP_PATH_IGNORE = '__MACOSX';

const ZIP_ENTRY_READ_OPTIONS: EntryGetDataOptions = {
  useWebWorkers: true,
  useCompressionStream: true,
};

const DETECTION_TIMEOUT = Symbol('detection-timeout');

async function streamZipEntryToStorageKey(
  entry: FileEntry,
  storage: StorageAdapter,
  key: string
): Promise<void> {
  const handle = await storage.getWritableHandle(key);
  const writable = await handle.createWritable();
  try {
    await entry.getData(writable, ZIP_ENTRY_READ_OPTIONS);
  } catch (e) {
    await writable.close().catch(() => {});
    throw e;
  }
}

async function readZipEntryAsBlob(entry: FileEntry): Promise<Blob> {
  const passthrough = new TransformStream<Uint8Array, Uint8Array>();
  const blobPromise = new Response(passthrough.readable).blob();
  await entry.getData(passthrough.writable, ZIP_ENTRY_READ_OPTIONS);
  return blobPromise;
}

export function isZipArchive(fileName: string): boolean {
  return /\.zip$/i.test(fileName);
}

export type DropSnapshot =
  | { kind: 'fs-entry'; entry: FileSystemEntry }
  | { kind: 'fs-directory-handle'; handle: FileSystemDirectoryHandle }
  | { kind: 'file'; file: File };

export type IntakeUploadSource = File[] | DropSnapshot[];

function dataTransferItemsToArray(list: DataTransferItemList): DataTransferItem[] {
  return Array.from({ length: list.length }, (_, i) => list[i]).filter(
    (item): item is DataTransferItem => item != null
  );
}

type DataTransferItemWithHandle = DataTransferItem & {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle>;
};

type SnapshotSlot =
  | { kind: 'done'; snap: DropSnapshot }
  | { kind: 'pending'; item: DataTransferItem };

export async function snapshotDataTransferItemsAsync(items: DataTransferItem[]): Promise<DropSnapshot[]> {
  const slots: SnapshotSlot[] = [];

  for (const item of items) {
    if (item.kind !== 'file') continue;

    const wk = item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null };
    const webkitEntry = wk.webkitGetAsEntry?.() ?? null;

    if (webkitEntry?.isDirectory) {
      slots.push({ kind: 'done', snap: { kind: 'fs-entry', entry: webkitEntry } });
      continue;
    }

    // Entries API must be consumed synchronously (multi-file drop); do not await before this.
    if (webkitEntry?.isFile) {
      slots.push({ kind: 'done', snap: { kind: 'fs-entry', entry: webkitEntry } });
      continue;
    }

    slots.push({ kind: 'pending', item });
  }

  const pending = slots.filter((s): s is { kind: 'pending'; item: DataTransferItem } => s.kind === 'pending');

  const handlePromises = pending.map(({ item }) => {
    const getHandle = (item as DataTransferItemWithHandle).getAsFileSystemHandle;
    if (typeof getHandle !== 'function') {
      return Promise.resolve(null as FileSystemHandle | null);
    }
    return getHandle.call(item).catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      if (e instanceof Error && e.name === 'AbortError') return null;
      return null;
    });
  });

  const handles = await Promise.all(handlePromises);

  const fileFromHandlePromises = handles.map((h) => {
    if (h?.kind === 'file') {
      return (h as FileSystemFileHandle).getFile().catch(() => null);
    }
    return Promise.resolve(null as File | null);
  });
  const filesFromHandles = await Promise.all(fileFromHandlePromises);

  const out: DropSnapshot[] = [];
  let pi = 0;
  for (const slot of slots) {
    if (slot.kind === 'done') {
      out.push(slot.snap);
      continue;
    }

    const h = handles[pi];
    const fileFromHandle = filesFromHandles[pi];
    pi += 1;

    if (!h) {
      const f = slot.item.getAsFile();
      if (f) out.push({ kind: 'file', file: f });
      continue;
    }
    if (h.kind === 'directory') {
      out.push({ kind: 'fs-directory-handle', handle: h as FileSystemDirectoryHandle });
      continue;
    }
    if (h.kind === 'file') {
      if (fileFromHandle) {
        out.push({ kind: 'file', file: fileFromHandle });
      } else {
        const f = slot.item.getAsFile();
        if (f) out.push({ kind: 'file', file: f });
      }
      continue;
    }

    const f = slot.item.getAsFile();
    if (f) out.push({ kind: 'file', file: f });
  }

  return out;
}

function dedupeDropSnapshots(snaps: DropSnapshot[]): DropSnapshot[] {
  const zipNamesFromFs = new Set<string>();
  for (const s of snaps) {
    if (s.kind === 'fs-entry' && s.entry.isFile && isZipArchive(s.entry.name)) {
      zipNamesFromFs.add(s.entry.name.toLowerCase());
    }
  }
  return snaps.filter(s => {
    if (s.kind !== 'file') return true;
    if (isZipArchive(s.file.name) && zipNamesFromFs.has(s.file.name.toLowerCase())) {
      return false;
    }
    return true;
  });
}

const HAS_FILELIST = typeof FileList !== 'undefined';

export async function normalizeIntakeSources(
  files: FileList | File[] | DataTransferItemList | DataTransferItem[]
): Promise<IntakeUploadSource> {
  if (HAS_FILELIST && files instanceof FileList) {
    return Array.from(files);
  }
  if (Array.isArray(files)) {
    if (files.length === 0) return [];
    if (files[0] instanceof File) {
      return files as File[];
    }
    return dedupeDropSnapshots(await snapshotDataTransferItemsAsync(files as DataTransferItem[]));
  }
  return dedupeDropSnapshots(
    await snapshotDataTransferItemsAsync(dataTransferItemsToArray(files as DataTransferItemList))
  );
}

function isFileUploadSource(source: IntakeUploadSource): source is File[] {
  if (source.length === 0) return true;
  return source[0] instanceof File;
}

export interface IntakeContext {
  createItem: (file: File, intakeKind: IntakeOriginalKind, dimensions?: { width: number; height: number }) => ImageItem;
  onExtractingArchive?: (archiveFileName: string) => void;
  onZipManifest?: (archiveFileName: string, entryCount: number) => void;
  onZipProgress?: (processed: number, total: number) => void;
  onZipStreamEnd?: () => void;
  onZipArchiveOversized?: (fileName: string) => void;
}

export type IntakeOriginalKind = 'direct' | 'buffered';

export type IntakeOriginalRef =
  | { kind: IntakeOriginalKind; file: File }
  | { kind: 'buffered-session'; itemId: string };

export interface CollectIntakeEntry {
  item: ImageItem;
  intakeOriginal?: IntakeOriginalRef | undefined;
}

export interface CollectIntakeResult {
  entries: CollectIntakeEntry[];
}

export function intakeEntriesToItems(entries: CollectIntakeEntry[]): ImageItem[] {
  return entries.map(e => e.item);
}

function createErrorCollectEntry(
  file: File,
  error: string,
  createItem: IntakeContext['createItem'],
  intakeKind: IntakeOriginalKind = 'direct'
): CollectIntakeEntry {
  if (isZipArchive(file.name)) {
    return {
      item: {
        id: nanoid(ID_RANDOM_LENGTH),
        fileName: file.name,
        mimeType: file.type || DEFAULT_MIME,
        originalSourceKind: intakeKind === 'direct' ? 'direct' : 'storage',
        status: STATUS_ERROR,
        progress: 0,
        originalSize: file.size,
        originalFormat: 'zip',
        error,
        results: {},
      },
    };
  }

  const item = createItem(file, intakeKind);
  item.status = STATUS_ERROR;
  item.error = error;
  for (const k of Object.keys(item.results)) {
    const r = item.results[k]!;
    item.results[k] = { ...r, status: STATUS_ERROR };
  }
  return {
    item,
    intakeOriginal: { kind: intakeKind, file },
  };
}

async function createValidatedItem(
  file: File,
  ctx: IntakeContext,
  intakeKind: IntakeOriginalKind,
  options?: { skipProbing?: boolean; overrideSize?: number }
): Promise<CollectIntakeEntry | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!isValidImageExtension(ext)) return null;

  const effectiveSize = options?.overrideSize ?? file.size;
  if (effectiveSize > MAX_FILE_SIZE_BYTES) {
    return createErrorCollectEntry(file, ERR_FILE_EXCEEDS_LIMIT, ctx.createItem, intakeKind);
  }

  let dimensions: { width: number; height: number } | undefined;
  let detectedMime: string | undefined;

  if (!options?.skipProbing) {
    try {
      // Attempt to get dimensions and type from stream with a 150ms timeout
      const result = await Promise.race([
        imageDimensionsFromStream(file.stream()),
        new Promise<typeof DETECTION_TIMEOUT>((resolve) => setTimeout(() => resolve(DETECTION_TIMEOUT), 150))
      ]);

      if (result && result !== DETECTION_TIMEOUT) {
        dimensions = { width: result.width, height: result.height };
        detectedMime = mimeByFormat(result.type);

        if (dimensions.width * dimensions.height > MAX_PIXELS) {
          const errEnt = createErrorCollectEntry(
            file,
            `Image dimensions too large (max ${Math.round(MAX_PIXELS / 1_000_000)} megapixels)`,
            ctx.createItem,
            intakeKind
          );
          errEnt.item.width = dimensions.width;
          errEnt.item.height = dimensions.height;
          return errEnt;
        }
      } else if (result === undefined && ext !== 'svg') {
        // Library returned undefined definitively -> invalid image content
        return createErrorCollectEntry(file, ERR_INVALID_FILE, ctx.createItem, intakeKind);
      }
    } catch {
      // Ignore errors for now (e.g. stream failure), we'll fall back to browser decode in thumbnail worker
    }
  }

  const item = ctx.createItem(file, intakeKind, dimensions);
  if (detectedMime) {
    item.mimeType = detectedMime;
  }
  if (options?.overrideSize !== undefined) {
    item.originalSize = options.overrideSize;
  }

  return {
    item,
    intakeOriginal: { kind: intakeKind, file },
  };
}

/** File entries in central-directory order (same counting rules as legacy zip walk). */
function buildZipWorkList(archiveEntries: Entry[]): { entry: FileEntry; fileName: string }[] {
  const work: { entry: FileEntry; fileName: string }[] = [];
  let fileCount = 0;
  for (const entry of archiveEntries) {
    if (entry.directory) continue;
    const path = entry.filename ?? '';
    if (path.includes(ZIP_PATH_IGNORE)) continue;
    const fileName = path.split('/').pop() ?? path;
    if (!fileName || fileName.length === 0) continue;
    fileCount += 1;
    if (fileCount > MAX_ZIP_EXTRACTED_FILES) {
      throw new Error('ZIP contains too many files');
    }
    work.push({ entry: entry as FileEntry, fileName });
  }
  return work;
}

async function* streamCollectIntakeFromZip(
  file: File,
  ctx: IntakeContext
): AsyncGenerator<CollectIntakeEntry> {
  ensureZipJsConfigured();
  ctx.onExtractingArchive?.(file.name);
  const zipReader = new ZipReader(new BlobReader(file));
  let extractedBytes = 0;
  try {
    const archiveEntries = await zipReader.getEntries();
    const work = buildZipWorkList(archiveEntries);
    ctx.onZipManifest?.(file.name, work.length);

    let processed = 0;
    for (const { entry, fileName } of work) {
      try {
        extractedBytes += entry.uncompressedSize;
        if (extractedBytes > MAX_ZIP_EXTRACTED_TOTAL_BYTES) {
          throw new Error('ZIP uncompressed data too large');
        }

        if (entry.uncompressedSize === 0) {
          continue;
        }
        if (entry.uncompressedSize > MAX_FILE_SIZE_BYTES) {
          const oversized = new File([], fileName, {
            type: getMimeType(fileName),
          });
          const errEnt = createErrorCollectEntry(oversized, ERR_FILE_EXCEEDS_LIMIT, ctx.createItem, 'buffered');
          errEnt.item.originalSize = entry.uncompressedSize;
          yield errEnt;
          continue;
        }

        if (getMimeType(fileName) === DEFAULT_MIME) {
          continue;
        }

        const ext = (fileName.split('.').pop() ?? '').toLowerCase();
        if (!isValidImageExtension(ext)) {
          continue;
        }

        const mime = getMimeType(fileName);
        const stubFile = new File([], fileName, { type: mime });
        const validated = await createValidatedItem(stubFile, ctx, 'buffered', {
          skipProbing: true,
          overrideSize: entry.uncompressedSize,
        });
        if (!validated) continue;
        if (validated.item.status === STATUS_ERROR) {
          // If it's a resolution error from createValidatedItem, it already has dimensions and intakeOriginal if it could get them.
          // But for ZIP entries we might need to attach the buffered source if it's already there.
          yield validated;
          continue;
        }

        validated.item.originalSize = entry.uncompressedSize;

        try {
          const storage = await getSessionBinaryStorage();
          await streamZipEntryToStorageKey(entry, storage, srcKey(validated.item.id));
          validated.intakeOriginal = { kind: 'buffered-session', itemId: validated.item.id };

          // Try to get dimensions from stored file if we didn't get them from stream (unlikely for zip but for consistency)
          if (!validated.item.width || !validated.item.height) {
            try {
              const storedFile = await storage.getBackedFile(srcKey(validated.item.id));
              if (storedFile) {
                const result = await Promise.race([
                  imageDimensionsFromStream(storedFile.stream()),
                  new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 100))
                ]);
                if (result) {
                  validated.item.width = result.width;
                  validated.item.height = result.height;
                }
              }
            } catch { /* ignore */ }
          }

          yield validated;
        } catch {
          const storage = await getSessionBinaryStorage();
          await storage.delete(srcKey(validated.item.id)).catch(() => {});
          const blob = await readZipEntryAsBlob(entry);
          const validFile = new File([blob], fileName, { type: mime });
          const fallback = await createValidatedItem(validFile, ctx, 'buffered');
          if (fallback) yield fallback;
        }
      } finally {
        processed += 1;
        ctx.onZipProgress?.(processed, work.length);
      }
    }
  } finally {
    await zipReader.close();
    ctx.onZipStreamEnd?.();
  }
}

async function* collectPlainFileYield(file: File, ctx: IntakeContext): AsyncGenerator<CollectIntakeEntry> {
  if (isZipArchive(file.name)) {
    if (file.size > MAX_ZIP_FILE_SIZE_BYTES) {
      ctx.onZipArchiveOversized?.(file.name);
      return;
    }
    try {
      yield* streamCollectIntakeFromZip(file, ctx);
    } catch (err) {
      yield createErrorCollectEntry(
        file,
        'ZIP extraction failed: ' + String(err),
        ctx.createItem,
        'direct'
      );
    }
    return;
  }

  const validated = await createValidatedItem(file, ctx, 'direct');
  if (validated) yield validated;
}

async function* traverseYield(
  entry: FileSystemEntry,
  ctx: IntakeContext
): AsyncGenerator<CollectIntakeEntry> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve) =>
      (entry as FileSystemFileEntry).file(resolve)
    );
    yield* collectPlainFileYield(file, ctx);
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
        yield* traverseYield(childEntry, ctx);
      }
    }
  }
}

async function* traverseDirectoryHandleYield(
  dirHandle: FileSystemDirectoryHandle,
  ctx: IntakeContext
): AsyncGenerator<CollectIntakeEntry> {
  for await (const [, handle] of (dirHandle as FileSystemDirectoryHandleWithEntries).entries()) {
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile();
      yield* collectPlainFileYield(file, ctx);
    } else {
      yield* traverseDirectoryHandleYield(handle as FileSystemDirectoryHandle, ctx);
    }
  }
}

export async function* iterateIntakeEntries(
  source: IntakeUploadSource,
  ctx: IntakeContext
): AsyncGenerator<CollectIntakeEntry> {
  if (!isFileUploadSource(source)) {
    for (const snap of source) {
      if (snap.kind === 'fs-entry') {
        yield* traverseYield(snap.entry, ctx);
      } else if (snap.kind === 'fs-directory-handle') {
        yield* traverseDirectoryHandleYield(snap.handle, ctx);
      } else {
        yield* collectPlainFileYield(snap.file, ctx);
      }
    }
    return;
  }

  for (const file of source) {
    yield* collectPlainFileYield(file, ctx);
  }
}

export async function collectItemsFromFiles(
  source: IntakeUploadSource,
  ctx: IntakeContext
): Promise<CollectIntakeResult> {
  const entries: CollectIntakeEntry[] = [];
  for await (const ent of iterateIntakeEntries(source, ctx)) {
    entries.push(ent);
  }
  return { entries };
}
