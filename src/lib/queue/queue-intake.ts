import {
  MAX_FILE_SIZE_BYTES,
  MAX_ZIP_FILE_SIZE_BYTES,
  MAX_ZIP_EXTRACTED_FILES,
  MAX_ZIP_EXTRACTED_TOTAL_BYTES,
  ID_RANDOM_LENGTH,
  ERR_FILE_EXCEEDS_LIMIT,
  ERR_HEIC_BROWSER,
  isValidImageExtension,
  STATUS_ERROR,
} from '@/constants';
import { getMimeType, DEFAULT_MIME, isHeicDecodeLikelySupported } from '@/lib/validation';
import type { ImageItem } from '@/lib/queue/types';
import type { Entry, EntryGetDataOptions, FileEntry } from '@zip.js/zip.js';
import { BlobReader, ZipReader } from '@zip.js/zip.js';
import { ensureZipJsConfigured } from '@/lib/zip-js-config';

const ZIP_PATH_IGNORE = '__MACOSX';

/** Decompression off main thread + native streams when available; per-entry data via WritableStream. */
const ZIP_ENTRY_READ_OPTIONS: EntryGetDataOptions = {
  useWebWorkers: true,
  useCompressionStream: true,
};

/**
 * Materializes one ZIP entry as a Blob on the main thread.
 * Future: stream large entries directly into session OPFS (hybrid `src:`) to avoid
 * holding uncompressed bytes twice (Blob + persist buffer) during intake.
 */
async function readZipEntryAsBlob(entry: FileEntry): Promise<Blob> {
  const passthrough = new TransformStream<Uint8Array, Uint8Array>();
  const blobPromise = new Response(passthrough.readable).blob();
  await entry.getData(passthrough.writable, ZIP_ENTRY_READ_OPTIONS);
  return blobPromise;
}

export function isZipArchive(fileName: string): boolean {
  return /\.zip$/i.test(fileName);
}

/** Snapshot from a drop: call synchronously inside `drop` so `webkitGetAsEntry` stays valid. */
export type DropSnapshot =
  | { kind: 'fs-entry'; entry: FileSystemEntry }
  | { kind: 'file'; file: File };

export type IntakeUploadSource = File[] | DropSnapshot[];

function dataTransferItemsToArray(list: DataTransferItemList): DataTransferItem[] {
  return Array.from({ length: list.length }, (_, i) => list[i]).filter(
    (item): item is DataTransferItem => item != null
  );
}

export function snapshotDataTransferItems(items: DataTransferItem[]): DropSnapshot[] {
  const out: DropSnapshot[] = [];
  for (const item of items) {
    if (item.kind !== 'file') continue;
    const entry = (
      item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }
    ).webkitGetAsEntry?.() ?? null;
    if (entry) {
      out.push({ kind: 'fs-entry', entry });
    } else {
      const f = item.getAsFile();
      if (f) out.push({ kind: 'file', file: f });
    }
  }
  return out;
}

/** Drop often exposes the same .zip as both `webkitGetAsEntry` and `getAsFile`; keep FS entry, skip duplicate file snapshot. */
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

export function normalizeIntakeSources(
  files: FileList | File[] | DataTransferItemList | DataTransferItem[]
): IntakeUploadSource {
  if (HAS_FILELIST && files instanceof FileList) {
    return Array.from(files);
  }
  if (Array.isArray(files)) {
    if (files.length === 0) return [];
    if (files[0] instanceof File) {
      return files as File[];
    }
    return dedupeDropSnapshots(snapshotDataTransferItems(files as DataTransferItem[]));
  }
  return dedupeDropSnapshots(
    snapshotDataTransferItems(dataTransferItemsToArray(files as DataTransferItemList))
  );
}

function isFileUploadSource(source: IntakeUploadSource): source is File[] {
  if (source.length === 0) return true;
  return source[0] instanceof File;
}

export interface IntakeContext {
  createItem: (file: File, intakeKind: IntakeOriginalKind) => ImageItem;
  /** Before zip.js reads entries (central directory). */
  onExtractingArchive?: (archiveFileName: string) => void;
  /** After central directory read: `entryCount` file records to walk (incl. non-images). Drives intake x/y. */
  onZipManifest?: (archiveFileName: string, entryCount: number) => void;
  /** After each manifest entry is fully handled (read + optional queue row). */
  onZipProgress?: (processed: number, total: number) => void;
  /** When this archive stream finishes (success or throw). Clears zip-specific intake totals. */
  onZipStreamEnd?: () => void;
  /** Compressed archive over {@link MAX_ZIP_FILE_SIZE_BYTES}; do not enqueue a row — UI should toast. */
  onZipArchiveOversized?: (fileName: string) => void;
}

/** Direct user file (picker / flat drop / `getAsFile` / folder file); buffered = ZIP-extracted bytes only. */
export type IntakeOriginalKind = 'direct' | 'buffered';

export interface CollectIntakeEntry {
  item: ImageItem;
  /**
   * When set, `intakeKind` tells the store how to retain bytes:
   * - `direct` → {@link registerDirectDropOriginal} (no hybrid `src:` write).
   * - `buffered` → persist to hybrid session storage (`src:${id}`).
   */
  intakeOriginal?: { kind: IntakeOriginalKind; file: File } | undefined;
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
        id: Math.random().toString(36).substring(2, 2 + ID_RANDOM_LENGTH),
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
  return { item };
}

function createValidatedItem(
  file: File,
  ctx: IntakeContext,
  intakeKind: IntakeOriginalKind
): CollectIntakeEntry | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!isValidImageExtension(ext)) return null;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return createErrorCollectEntry(file, ERR_FILE_EXCEEDS_LIMIT, ctx.createItem, intakeKind);
  }
  if ((ext === 'heic' || ext === 'heif') && !isHeicDecodeLikelySupported()) {
    return createErrorCollectEntry(file, ERR_HEIC_BROWSER, ctx.createItem, intakeKind);
  }

  return {
    item: ctx.createItem(file, intakeKind),
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
        const blob: Blob = await readZipEntryAsBlob(entry);
        extractedBytes += blob.size;
        if (extractedBytes > MAX_ZIP_EXTRACTED_TOTAL_BYTES) {
          throw new Error('ZIP uncompressed data too large');
        }

        if (blob.size === 0) {
          continue;
        }
        if (blob.size > MAX_FILE_SIZE_BYTES) {
          const oversized = new File([], fileName, {
            type: getMimeType(fileName),
          });
          yield createErrorCollectEntry(oversized, ERR_FILE_EXCEEDS_LIMIT, ctx.createItem, 'buffered');
          continue;
        }

        if (getMimeType(fileName) === DEFAULT_MIME) {
          continue;
        }

        const ext = (fileName.split('.').pop() ?? '').toLowerCase();
        if (!isValidImageExtension(ext)) {
          continue;
        }

        const validFile = new File([blob], fileName, {
          type: getMimeType(fileName),
        });
        const validated = createValidatedItem(validFile, ctx, 'buffered');
        if (validated) yield validated;
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

  const validated = createValidatedItem(file, ctx, 'direct');
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

/**
 * Yields each queue intake entry as it becomes ready (ZIP: one row per decompressed image as streamed).
 */
export async function* iterateIntakeEntries(
  source: IntakeUploadSource,
  ctx: IntakeContext
): AsyncGenerator<CollectIntakeEntry> {
  if (!isFileUploadSource(source)) {
    for (const snap of source) {
      if (snap.kind === 'fs-entry') {
        yield* traverseYield(snap.entry, ctx);
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
