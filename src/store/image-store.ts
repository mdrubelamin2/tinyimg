/**
 * Image queue state: Legend State observables + fine-grained React selectors.
 * Worker pool integration, RAF-batched worker results, and OPFS download unchanged in behavior.
 */

import { startTransition } from 'react';
import { batch, observable } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import type { ImageItem, ImageResult, Task, WorkerOutbound, WorkerOutboundResult } from '@/lib/queue/types';
import type { GlobalOptions } from '@/constants';
import {
  STATUS_PENDING,
  STATUS_PROCESSING,
  STATUS_SUCCESS,
  STATUS_ERROR,
  ERR_WORKER,
  OUTPUT_QUALITY_MAX,
  OUTPUT_QUALITY_MIN,
  UPDATE_OPTIONS_DEBOUNCE_MS,
} from '@/constants';
import { WorkerPool, computeConcurrency } from '@/workers/worker-pool-v2';
import {
  iterateIntakeEntries,
  normalizeIntakeSources,
  type CollectIntakeEntry,
  type IntakeOriginalKind,
} from '@/lib/queue/queue-intake';
import { registerDirectDropOriginal, releaseDirectDropOriginal, clearDirectDropOriginals } from '@/storage/dropped-original-files';
import {
  persistBufferedOriginalSource,
  resolveOriginalSourceFile,
  deleteItemPayloads,
  persistEncodedOutput,
} from '@/storage/queue-binary';
import { heapMetrics } from '@/lib/dev/heap-metrics';
import {
  cancelThumbnail,
  destroyThumbnailWorker,
  enqueueThumbnails,
} from '@/thumbnails/thumbnail-generator';
import { toastError } from '@/notifications/toast-emitter';
import { ERR_ZIP_EXCEEDS_LIMIT, ERR_INTAKE_STORAGE_FULL } from '@/constants';
import { isQuotaExceededError } from '@/lib/storage/quota-error';
import { thumbnailCacheClear } from '@/thumbnails/thumbnail-cache';
import { createQueueItem, resetItemResultsForOptions } from '@/lib/queue/queue-item';
import { buildOutputSlots } from '@/lib/queue/output-slots';
import { revokeResultUrls, buildAndDownloadZip } from '@/lib/download';
import { useSettingsStore } from './settings-store';

// --- Observable session state (Map-like item bag + order + scheduling sets) ---
export const imageStore$ = observable({
  /** Per-id queue rows; absent key means removed */
  items: {} as Record<string, ImageItem | undefined>,
  itemOrder: [] as string[],
  /** Unique pending ids (order not significant) */
  pendingIds: [] as string[],
  /** Visible row ids from virtualization (order not significant) */
  visibleItemIds: [] as string[],
});

const INTAKE_UI_CHUNK = 40;
const INTAKE_PERSIST_CONCURRENCY = 6;

/** Large-drop intake progress (toast while `addFiles` is running). */
export const intake$ = observable({
  active: false,
  phase: 'idle' as 'idle' | 'collecting' | 'merging',
  label: '',
  processed: 0,
  total: 0,
});

interface ImageStoreState {
  items: Map<string, ImageItem>;
  itemOrder: string[];
  pendingIds: Set<string>;
  visibleItemIds: Set<string>;
}

interface ImageStoreActions {
  addFiles: (files: FileList | File[] | DataTransferItemList | DataTransferItem[], options: GlobalOptions) => Promise<void>;
  removeItem: (id: string) => void;
  clearFinished: () => void;
  clearAll: () => void;
  reorderItems: (fromIndex: number, toIndex: number) => void;
  setItemOutputFormats: (id: string, formats: string[] | null, options: GlobalOptions) => void;
  setItemQualityPercent: (id: string, percent: number | null, options: GlobalOptions) => void;
  setVisibleItems: (ids: string[]) => void;
  downloadAll: () => Promise<void>;
  applyGlobalOptions: (options: GlobalOptions, forceAll?: boolean) => void;
  _applyWorkerResult: (response: WorkerOutbound) => void;
  _applyWorkerError: (task: Task | null) => void;
  _batchApplyResults: () => void;
  _getPool: () => WorkerPool;
  _processNext: (options: GlobalOptions) => void;
  _processNextAsync: (options: GlobalOptions, api: { getState: () => ImageStore }) => Promise<void>;
}

export type ImageStore = ImageStoreState & ImageStoreActions;

let pool: WorkerPool | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingForceAll = false;

let responseBuffer: WorkerOutbound[] = [];
let errorBuffer: (Task | null)[] = [];
let flushScheduled = false;

/** Serializes persist work across RAF batches so large `encodedBytes` are not retained concurrently. */
let resultPersistChain: Promise<void> = Promise.resolve();

function schedulePersistWorkerResults(results: WorkerOutboundResult[]): void {
  if (results.length === 0) return;
  const totalBytes = results.reduce((sum, r) => sum + r.encodedBytes.byteLength, 0);
  heapMetrics.resultBatchReceived(results.length, totalBytes);
  const queue = [...results];
  resultPersistChain = resultPersistChain.then(async () => {
    const opts = useSettingsStore.getState().options;
    while (queue.length > 0) {
      const response = queue.shift()!;
      const byteLen = response.encodedBytes.byteLength;
      heapMetrics.persistPipelineEnter();
      const t0 = performance.now();
      try {
        const snapshot = imageStore$.items[response.id]?.peek();
        if (!snapshot) continue;
        const rid = response.resultId;
        const prevResult = snapshot.results[rid];
        if (!prevResult) continue;

        if (prevResult.downloadUrl) URL.revokeObjectURL(prevResult.downloadUrl);
        const { payloadKey } = await persistEncodedOutput(
          response.id,
          rid,
          response.encodedBytes,
          response.mimeType
        );

        startTransition(() => {
          batch(() => {
            const item = imageStore$.items[response.id]?.peek();
            if (!item) return;
            const result = item.results[rid];
            if (!result) return;

            const nextItem = { ...item };
            nextItem.results = {
              ...item.results,
              [rid]: {
                ...result,
                status: STATUS_SUCCESS,
                size: response.size,
                formattedSize: response.formattedSize,
                savingsPercent: response.savingsPercent,
                payloadKey,
                label: response.label,
                downloadUrl: undefined,
                timing: response.timing,
              },
            };

            let nextPending = [...imageStore$.pendingIds.peek()];
            let shouldProcessNext = false;
            if (isTerminal(nextItem)) {
              const anyError = Object.values(nextItem.results).some(r => r.status === STATUS_ERROR);
              nextItem.status = anyError ? STATUS_ERROR : STATUS_SUCCESS;
              nextItem.progress = 100;
              nextPending = nextPending.filter(x => x !== response.id);
              shouldProcessNext = true;
            }

            imageStore$.items[response.id]!.set(nextItem);
            imageStore$.pendingIds.set(nextPending);

            if (shouldProcessNext) {
              void getState()._processNextAsync(opts, { getState });
            }
          });
        });
      } finally {
        heapMetrics.persistDurationMs(performance.now() - t0, byteLen);
        heapMetrics.persistPipelineExit();
      }
    }
  });
  void resultPersistChain.catch((err) => {
    console.error('result persist chain', err);
  });
}

function getPool(storeApi: { getState: () => ImageStore }): WorkerPool {
  if (pool) return pool;
  pool = new WorkerPool(computeConcurrency(), {
    onMessage: (_workerIndex, data) => {
      storeApi.getState()._applyWorkerResult(data as WorkerOutbound);
    },
    onError: (_workerIndex, task) => {
      storeApi.getState()._applyWorkerError(task);
    },
  });
  return pool;
}

function isTerminal(item: ImageItem): boolean {
  return !Object.values(item.results).some(
    r => r.status === STATUS_PROCESSING || r.status === STATUS_PENDING
  );
}

let cachedItemsRef: Map<string, ImageItem> | null = null;
let cachedOrderRef: string[] | null = null;
let cachedOrderedItems: ImageItem[] = [];

function itemsToArray(items: Map<string, ImageItem>, order: string[]): ImageItem[] {
  if (items === cachedItemsRef && order === cachedOrderRef) {
    return cachedOrderedItems;
  }

  cachedItemsRef = items;
  cachedOrderRef = order;
  cachedOrderedItems = order.map(id => items.get(id)).filter((i): i is ImageItem => i != null);
  return cachedOrderedItems;
}

function snapshotItemsMap(): Map<string, ImageItem> {
  const m = new Map<string, ImageItem>();
  for (const id of imageStore$.itemOrder.peek()) {
    const it = imageStore$.items[id]?.peek();
    if (it) m.set(id, it);
  }
  return m;
}

function replaceItemsMap(next: Map<string, ImageItem>): void {
  for (const id of Object.keys(imageStore$.items.peek())) {
    if (!next.has(id)) {
      imageStore$.items[id]?.delete();
    }
  }
  for (const [id, item] of next) {
    imageStore$.items[id]!.set(item);
  }
}

async function persistIntakeOriginalsParallel(chunk: CollectIntakeEntry[]): Promise<void> {
  const todo = chunk.filter(e => e.item.status === STATUS_PENDING && e.intakeOriginal);
  for (let k = 0; k < todo.length; k += INTAKE_PERSIST_CONCURRENCY) {
    const slice = todo.slice(k, k + INTAKE_PERSIST_CONCURRENCY);
    await Promise.all(
      slice.map(async (ent) => {
        const o = ent.intakeOriginal!;
        if (o.kind === 'direct') {
          registerDirectDropOriginal(ent.item.id, o.file);
        } else {
          await persistBufferedOriginalSource(ent.item.id, o.file);
        }
      })
    );
  }
}

export async function addFiles(
  files: FileList | File[] | DataTransferItemList | DataTransferItem[],
  options: GlobalOptions
): Promise<void> {
  batch(() => {
    intake$.active.set(true);
    intake$.phase.set('collecting');
    intake$.label.set('Scanning dropped items…');
    intake$.processed.set(0);
    intake$.total.set(0);
  });

  try {
    const source = normalizeIntakeSources(files);
    /** >0 while at least one zip stream is open (nested-safe); drives per-entry merge vs batch buffer. */
    const zipIntakeState = { depth: 0 };

    const ctx = {
      createItem: (file: File, intakeKind: IntakeOriginalKind) =>
        createQueueItem(file, options, intakeKind),
      onExtractingArchive: (archiveName: string) => {
        batch(() => {
          intake$.label.set(`Reading ${archiveName}…`);
        });
      },
      onZipManifest: (archiveName: string, entryCount: number) => {
        zipIntakeState.depth += 1;
        batch(() => {
          intake$.label.set(`Extracting ${archiveName}…`);
          intake$.total.set(entryCount);
          intake$.processed.set(0);
        });
      },
      onZipProgress: (processed: number, total: number) => {
        batch(() => {
          intake$.processed.set(processed);
          intake$.total.set(total);
        });
      },
      onZipStreamEnd: () => {
        zipIntakeState.depth = Math.max(0, zipIntakeState.depth - 1);
        if (zipIntakeState.depth === 0) {
          batch(() => {
            intake$.total.set(0);
            intake$.processed.set(0);
          });
        }
      },
      onZipArchiveOversized: (fileName: string) => {
        toastError(`${fileName}: ${ERR_ZIP_EXCEEDS_LIMIT}`);
      },
    };

    const buffer: CollectIntakeEntry[] = [];

    const mergeChunkToStore = (chunk: CollectIntakeEntry[]) => {
      batch(() => {
        const order = [...imageStore$.itemOrder.peek()];
        const pending = [...imageStore$.pendingIds.peek()];
        for (const ent of chunk) {
          imageStore$.items[ent.item.id]!.set(ent.item);
          if (!order.includes(ent.item.id)) order.push(ent.item.id);
          if (ent.item.status === STATUS_PENDING && !pending.includes(ent.item.id)) {
            pending.push(ent.item.id);
          }
        }
        imageStore$.itemOrder.set(order);
        imageStore$.pendingIds.set(pending);
      });
      enqueueThumbnails(chunk.map(e => e.item.id));
    };

    const flushBuffer = async () => {
      if (buffer.length === 0) return;
      const chunk = buffer.splice(0, buffer.length);
      await persistIntakeOriginalsParallel(chunk);
      mergeChunkToStore(chunk);
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      });
    };

    batch(() => {
      intake$.phase.set('merging');
      intake$.label.set('Adding to queue…');
    });

    try {
      for await (const ent of iterateIntakeEntries(source, ctx)) {
        if (zipIntakeState.depth > 0) {
          await persistIntakeOriginalsParallel([ent]);
          mergeChunkToStore([ent]);
          await new Promise<void>(resolve => {
            requestAnimationFrame(() => resolve());
          });
        } else {
          buffer.push(ent);
          if (buffer.length >= INTAKE_UI_CHUNK) {
            await flushBuffer();
          }
        }
      }

      await flushBuffer();
    } catch (err) {
      if (isQuotaExceededError(err)) {
        toastError(ERR_INTAKE_STORAGE_FULL);
        buffer.length = 0;
      } else {
        throw err;
      }
    }

    void getState()._processNextAsync(options, { getState });
  } finally {
    batch(() => {
      intake$.active.set(false);
      intake$.phase.set('idle');
      intake$.label.set('');
      intake$.processed.set(0);
      intake$.total.set(0);
    });
  }
}

function removeItemImpl(id: string, api: { getState: () => ImageStore }): void {
  const item = imageStore$.items[id]?.peek();
  if (!item) return;

  getPool(api).abortInFlightForItem(id);
  cancelThumbnail(id);
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  revokeResultUrls(item);
  releaseDirectDropOriginal(id);
  void deleteItemPayloads(id);

  batch(() => {
    imageStore$.items[id]?.delete();
    imageStore$.itemOrder.set(imageStore$.itemOrder.peek().filter(i => i !== id));
    imageStore$.pendingIds.set(imageStore$.pendingIds.peek().filter(x => x !== id));
  });
}

function clearFinishedImpl(): void {
  batch(() => {
    const prevOrder = [...imageStore$.itemOrder.peek()];
    const nextItems = new Map<string, ImageItem>();
    const nextOrder: string[] = [];
    const nextPending: string[] = [];
    for (const id of prevOrder) {
      const item = imageStore$.items[id]?.peek();
      if (!item) continue;
      if (item.status === STATUS_PROCESSING || item.status === STATUS_PENDING) {
        nextItems.set(id, item);
        nextOrder.push(id);
        if (item.status === STATUS_PENDING) {
          nextPending.push(id);
        }
        continue;
      }
      cancelThumbnail(id);
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      revokeResultUrls(item);
      releaseDirectDropOriginal(id);
      void deleteItemPayloads(id);
    }
    replaceItemsMap(nextItems);
    imageStore$.itemOrder.set(nextOrder);
    imageStore$.pendingIds.set(nextPending);
  });
}

function clearAllImpl(): void {
  destroyThumbnailWorker();
  thumbnailCacheClear();
  for (const id of imageStore$.itemOrder.peek()) {
    const item = imageStore$.items[id]?.peek();
    if (!item) continue;
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    revokeResultUrls(item);
    void deleteItemPayloads(id);
  }
  clearDirectDropOriginals();
  if (pool) pool.destroy();
  pool = null;
  batch(() => {
    for (const id of Object.keys(imageStore$.items.peek())) {
      imageStore$.items[id]?.delete();
    }
    imageStore$.itemOrder.set([]);
    imageStore$.pendingIds.set([]);
    imageStore$.visibleItemIds.set([]);
    intake$.active.set(false);
    intake$.phase.set('idle');
    intake$.label.set('');
    intake$.processed.set(0);
    intake$.total.set(0);
  });
}

function reorderItemsImpl(fromIndex: number, toIndex: number): void {
  const order = [...imageStore$.itemOrder.peek()];
  if (
    fromIndex < 0 || toIndex < 0 ||
    fromIndex >= order.length || toIndex >= order.length ||
    fromIndex === toIndex
  ) {
    return;
  }
  const nextOrder = [...order];
  const [removed] = nextOrder.splice(fromIndex, 1);
  nextOrder.splice(toIndex, 0, removed!);
  imageStore$.itemOrder.set(nextOrder);
}

function setItemOutputFormatsImpl(id: string, formats: string[] | null, options: GlobalOptions, api: { getState: () => ImageStore }): void {
  const currentPool = getPool(api);
  currentPool.abortInFlightForItem(id);
  currentPool.removeTasksForItem(id);

  const item = imageStore$.items[id]?.peek();
  if (!item) return;

  revokeResultUrls(item);
  const nextItem: ImageItem = {
    ...item,
    outputFormatsOverride: formats != null && formats.length > 0 ? formats : null,
    status: STATUS_PENDING,
    progress: 0,
    error: undefined,
  };

  const slots = buildOutputSlots(nextItem, options);
  const results: Record<string, ImageResult> = {};
  for (const slot of slots) {
    results[slot.resultId] = {
      resultId: slot.resultId,
      format: slot.format,
      variantLabel: slot.variantLabel,
      status: STATUS_PENDING,
    };
  }
  nextItem.results = results;

  batch(() => {
    imageStore$.items[id]!.set(nextItem);
    const pending = [...imageStore$.pendingIds.peek()];
    if (!pending.includes(id)) pending.push(id);
    imageStore$.pendingIds.set(pending);
  });

  void getState()._processNextAsync(options, { getState });
}

function setItemQualityPercentImpl(id: string, percent: number | null, options: GlobalOptions, api: { getState: () => ImageStore }): void {
  const clamped = percent == null
    ? null
    : Math.min(OUTPUT_QUALITY_MAX, Math.max(OUTPUT_QUALITY_MIN, Math.round(percent)));

  const currentPool = getPool(api);
  currentPool.abortInFlightForItem(id);
  currentPool.removeTasksForItem(id);

  const item = imageStore$.items[id]?.peek();
  if (!item) return;

  revokeResultUrls(item);
  const nextItem: ImageItem = {
    ...item,
    qualityPercentOverride: clamped,
    status: STATUS_PENDING,
    progress: 0,
    error: undefined,
  };

  const slots = buildOutputSlots(nextItem, options);
  const results: Record<string, ImageResult> = {};
  for (const slot of slots) {
    results[slot.resultId] = {
      resultId: slot.resultId,
      format: slot.format,
      variantLabel: slot.variantLabel,
      status: STATUS_PENDING,
    };
  }
  nextItem.results = results;

  batch(() => {
    imageStore$.items[id]!.set(nextItem);
    const pending = [...imageStore$.pendingIds.peek()];
    if (!pending.includes(id)) pending.push(id);
    imageStore$.pendingIds.set(pending);
  });

  void getState()._processNextAsync(options, { getState });
}

function setVisibleItemsImpl(ids: string[]): void {
  imageStore$.visibleItemIds.set([...ids]);
}

function applyGlobalOptionsImpl(options: GlobalOptions, forceAll: boolean): void {
  if (forceAll) pendingForceAll = true;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const isForced = pendingForceAll;
    pendingForceAll = false;
    debounceTimer = null;

    batch(() => {
      const nextItems = new Map<string, ImageItem>();
      const nextPending: string[] = [];
      for (const id of imageStore$.itemOrder.peek()) {
        const item = imageStore$.items[id]?.peek();
        if (!item) continue;
        if (isForced || item.status === STATUS_PENDING || item.status === STATUS_PROCESSING) {
          const nextItem = resetItemResultsForOptions(item, options);
          nextItems.set(id, nextItem);
          nextPending.push(id);
        } else {
          nextItems.set(id, item);
        }
      }
      replaceItemsMap(nextItems);
      imageStore$.pendingIds.set(nextPending);
    });

    void getState()._processNextAsync(options, { getState });
  }, UPDATE_OPTIONS_DEBOUNCE_MS);
}

function _applyWorkerResultImpl(response: WorkerOutbound): void {
  responseBuffer.push(response);
  if (!flushScheduled) {
    flushScheduled = true;
    requestAnimationFrame(() => {
      getState()._batchApplyResults();
    });
  }
}

function _applyWorkerErrorImpl(task: Task | null): void {
  errorBuffer.push(task);
  if (!flushScheduled) {
    flushScheduled = true;
    requestAnimationFrame(() => {
      getState()._batchApplyResults();
    });
  }
}

function _batchApplyResultsImpl(): void {
  const responses = [...responseBuffer] as WorkerOutbound[];
  const errors = [...errorBuffer];
  responseBuffer = [];
  errorBuffer = [];
  flushScheduled = false;

  if (responses.length === 0 && errors.length === 0) return;

  const resultResponses = responses.filter((r): r is Extract<WorkerOutbound, { type: 'RESULT' }> => r.type === 'RESULT');
  const otherResponses = responses.filter(r => r.type !== 'RESULT');

  let shouldProcessNextSync = false;

  startTransition(() => {
    batch(() => {
      const itemsMap = snapshotItemsMap();
      let nextPending = [...imageStore$.pendingIds.peek()];

      for (const response of otherResponses) {
        if (response.type === 'ERROR') {
          const item = itemsMap.get(response.id);
          if (!item) continue;

          const rid = response.resultId;
          const result = item.results[rid];
          const nextItem = { ...item };
          if (result) {
            nextItem.results = {
              ...item.results,
              [rid]: { ...result, status: STATUS_ERROR, error: response.error },
            };
          }

          if (isTerminal(nextItem)) {
            nextItem.status = STATUS_ERROR;
            nextItem.progress = 100;
            nextPending = nextPending.filter(x => x !== response.id);
            shouldProcessNextSync = true;
          }

          itemsMap.set(response.id, nextItem);
          imageStore$.items[response.id]!.set(nextItem);
        }
      }

      for (const task of errors) {
        if (!task) continue;
        const item = itemsMap.get(task.id);
        if (!item) continue;

        const result = item.results[task.resultId];
        const nextItem = { ...item };
        if (result) {
          nextItem.results = {
            ...item.results,
            [task.resultId]: { ...result, status: STATUS_ERROR, error: ERR_WORKER },
          };
        }

        if (isTerminal(nextItem)) {
          nextItem.status = STATUS_ERROR;
          nextItem.progress = 100;
          nextPending = nextPending.filter(x => x !== task.id);
          shouldProcessNextSync = true;
        }

        itemsMap.set(task.id, nextItem);
        imageStore$.items[task.id]!.set(nextItem);
      }

      imageStore$.pendingIds.set(nextPending);
    });

    if (shouldProcessNextSync) {
      void getState()._processNextAsync(useSettingsStore.getState().options, { getState });
    }
  });

  if (resultResponses.length === 0) return;

  schedulePersistWorkerResults(resultResponses);
}

async function _processNextAsyncImpl(
  options: GlobalOptions,
  api: { getState: () => ImageStore }
): Promise<void> {
  const items = snapshotItemsMap();
  const itemOrder = imageStore$.itemOrder.peek();
  const pendingIds = imageStore$.pendingIds.peek();
  const visibleItemIds = imageStore$.visibleItemIds.peek();

  if (pendingIds.length === 0) return;

  const currentPendingArray = itemOrder.filter(id => pendingIds.includes(id));
  if (currentPendingArray.length === 0) return;

  const sortedIds = [...currentPendingArray].sort((a, b) => {
    const aVisible = visibleItemIds.includes(a);
    const bVisible = visibleItemIds.includes(b);

    if (aVisible && !bVisible) return -1;
    if (!aVisible && bVisible) return 1;

    if (options.smallFilesFirst) {
      const itemA = items.get(a);
      const itemB = items.get(b);
      if (!itemA || !itemB) return 0;
      return itemA.originalSize - itemB.originalSize;
    }

    return 0;
  });

  const nextId = sortedIds[0];
  if (!nextId) return;
  const nextItem = items.get(nextId);
  if (!nextItem || nextItem.status !== STATUS_PENDING) return;

  const sourceFile = await resolveOriginalSourceFile(nextId, nextItem);
  if (!sourceFile) return;

  const processingItem: ImageItem = { ...nextItem, status: STATUS_PROCESSING };
  const slots = buildOutputSlots(processingItem, options);
  const currentPool = getPool(api);

  for (const slot of slots) {
    if (!processingItem.results[slot.resultId]) continue;
    processingItem.results = {
      ...processingItem.results,
      [slot.resultId]: { ...processingItem.results[slot.resultId]!, status: STATUS_PROCESSING },
    };
    currentPool.addTask({
      id: processingItem.id,
      resultId: slot.resultId,
      format: slot.format,
      file: sourceFile,
      options: {
        resultId: slot.resultId,
        format: slot.format,
        svgInternalFormat: options.svgInternalFormat,
        svgRasterizer: 'resvg' as const,
        svgExportDensity: 'display' as const,
        svgDisplayDpr: 2,
        qualityPercent: processingItem.qualityPercentOverride ?? 100,
        resizePreset: slot.resizePreset,
        stripMetadata: options.stripMetadata,
      },
    });
  }

  batch(() => {
    imageStore$.items[nextId]!.set(processingItem);
    imageStore$.pendingIds.set(imageStore$.pendingIds.peek().filter(x => x !== nextId));
  });
}

function _processNextImpl(options: GlobalOptions, api: { getState: () => ImageStore }): void {
  void _processNextAsyncImpl(options, api);
}

function getState(): ImageStore {
  return imageStoreSingleton;
}

const imageStoreSingleton: ImageStore = {
  get items() {
    return snapshotItemsMap();
  },
  get itemOrder() {
    return [...imageStore$.itemOrder.peek()];
  },
  get pendingIds() {
    return new Set(imageStore$.pendingIds.peek() as string[]);
  },
  get visibleItemIds() {
    return new Set(imageStore$.visibleItemIds.peek() as string[]);
  },
  addFiles,
  removeItem(id: string) {
    removeItemImpl(id, { getState });
  },
  clearFinished: clearFinishedImpl,
  clearAll() {
    clearAllImpl();
  },
  reorderItems: reorderItemsImpl,
  setItemOutputFormats(id, formats, options) {
    setItemOutputFormatsImpl(id, formats, options, { getState });
  },
  setItemQualityPercent(id, percent, options) {
    setItemQualityPercentImpl(id, percent, options, { getState });
  },
  setVisibleItems: setVisibleItemsImpl,
  async downloadAll() {
    const arr = itemsToArray(snapshotItemsMap(), imageStore$.itemOrder.peek());
    await buildAndDownloadZip(arr);
  },
  applyGlobalOptions(options, forceAll = false) {
    applyGlobalOptionsImpl(options, forceAll ?? false);
  },
  _applyWorkerResult: _applyWorkerResultImpl,
  _applyWorkerError: _applyWorkerErrorImpl,
  _batchApplyResults() {
    _batchApplyResultsImpl();
  },
  _getPool() {
    return getPool({ getState });
  },
  _processNext(options) {
    _processNextImpl(options, { getState });
  },
  _processNextAsync(options, api) {
    return _processNextAsyncImpl(options, api);
  },
};

function setState(
  partial: Partial<Pick<ImageStoreState, 'items' | 'itemOrder' | 'pendingIds'>>
): void {
  batch(() => {
    if (partial.items) {
      replaceItemsMap(partial.items);
    }
    if (partial.itemOrder) {
      imageStore$.itemOrder.set([...partial.itemOrder]);
    }
    if (partial.pendingIds) {
      imageStore$.pendingIds.set([...partial.pendingIds]);
    }
  });
}

/**
 * Zustand-shaped hook: subscribe to observables read inside `selector`.
 * Prefer `useValue` from `@legendapp/state/react` at call sites for clarity.
 */
function useImageStoreSelect<T>(selector: (state: ImageStore) => T): T {
  return useValue(() => selector(getState()));
}

export const useImageStore = Object.assign(useImageStoreSelect, {
  getState,
  setState,
});

/** Imperative store access (avoids `use*` naming that trips React Compiler). Prefer in non-hook code. */
export { getState as getImageStore, setState as setImageStoreState };

export function selectItemById(id: string) {
  return (state: ImageStore) => state.items.get(id);
}

export function selectOrderedItems(state: ImageStore): ImageItem[] {
  return itemsToArray(state.items, state.itemOrder);
}

export function selectItemCount(state: ImageStore): number {
  return state.itemOrder.length;
}
