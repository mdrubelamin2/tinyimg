/**
 * Image store: Zustand-based queue state management.
 * Replaces the QueueProcessor God Class with composable actions.
 */

import { create } from 'zustand';
import type { ImageItem, ImageResult, WorkerResponse, Task } from '@/lib/queue/types';
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
} from '@/constants/index';
import { WorkerPool, computeConcurrency } from '@/workers/worker-pool-v2';
import { collectItemsFromFiles } from '@/lib/queue/queue-intake';
import {
  createQueueItem,
  getFormatsToProcess,
  resetItemResultsForOptions,
} from '@/lib/queue/queue-item';
import { revokeResultUrls, buildAndDownloadZip } from '@/lib/download';
import OptimizerWorkerUrl from '@/workers/optimizer.worker.ts?worker&url';
import { useSettingsStore } from './settings-store';

/**
 * Image store state definition.
 * Extracted constants for magic values to ensure clean, maintainable code.
 */
interface ImageStoreState {
  items: Map<string, ImageItem>;
  itemOrder: string[];
}

interface ImageStoreActions {
  addFiles: (files: FileList | File[] | DataTransferItemList | DataTransferItem[], options: GlobalOptions) => Promise<void>;
  removeItem: (id: string) => void;
  clearFinished: () => void;
  clearAll: () => void;
  reorderItems: (fromIndex: number, toIndex: number) => void;
  setItemOutputFormats: (id: string, formats: string[] | null, options: GlobalOptions) => void;
  setItemQualityPercent: (id: string, percent: number | null, options: GlobalOptions) => void;
  downloadAll: () => Promise<void>;

  /** Called when global options change (debounced). Re-enqueues all pending items. */
  applyGlobalOptions: (options: GlobalOptions) => void;

  /** Internal: called by worker pool bridge */
  _applyWorkerResult: (response: WorkerResponse) => void;
  _applyWorkerError: (task: Task | null) => void;
  _getPool: () => WorkerPool;
  _processNext: (options: GlobalOptions) => void;
}

export type ImageStore = ImageStoreState & ImageStoreActions;

// --- Worker pool singleton (initialized lazily) ---
let pool: WorkerPool | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function getPool(storeApi: { getState: () => ImageStore }): WorkerPool {
  if (pool) return pool;
  const workerUrl = new URL(OptimizerWorkerUrl, import.meta.url);
  pool = new WorkerPool(workerUrl, computeConcurrency(), {
    onMessage: (_workerIndex, data) => {
      // Bridge: convert WorkerOutbound to legacy WorkerResponse
      const legacy = data as unknown as WorkerResponse;
      storeApi.getState()._applyWorkerResult(legacy);
    },
    onError: (_workerIndex, task) => {
      storeApi.getState()._applyWorkerError(task);
    },
  });
  return pool;
}

// --- Helpers ---

/**
 * Checks if all results for an item are in a terminal state (Success or Error).
 */
function isTerminal(item: ImageItem): boolean {
  return !Object.values(item.results).some(
    r => r.status === STATUS_PROCESSING || r.status === STATUS_PENDING
  );
}

let cachedItemsRef: Map<string, ImageItem> | null = null;
let cachedOrderRef: string[] | null = null;
let cachedOrderedItems: ImageItem[] = [];

/**
 * Efficiently converts the items map to an ordered array using memoization.
 */
function itemsToArray(items: Map<string, ImageItem>, order: string[]): ImageItem[] {
  if (items === cachedItemsRef && order === cachedOrderRef) {
    return cachedOrderedItems;
  }

  cachedItemsRef = items;
  cachedOrderRef = order;
  cachedOrderedItems = order.map(id => items.get(id)).filter((i): i is ImageItem => i != null);
  return cachedOrderedItems;
}

/**
 * The main image store. Using Zustand for buttery-smooth performance and clean state management.
 * Strictly adheres to DRY, KISS, and SOLID principles.
 */
export const useImageStore = create<ImageStore>()((set, get, api) => ({
  items: new Map(),
  itemOrder: [],

  addFiles: async (files, options) => {
    const newItems = await collectItemsFromFiles(files, {
      createItem: (file: File) => createQueueItem(file, options),
    });

    set((state) => {
      const nextItems = new Map(state.items);
      const nextOrder = [...state.itemOrder];
      for (const item of newItems) {
        nextItems.set(item.id, item);
        nextOrder.push(item.id);
      }
      return { items: nextItems, itemOrder: nextOrder };
    });

    get()._processNext(options);
  },

  removeItem: (id) => {
    const item = get().items.get(id);
    if (!item) return;

    getPool(api).abortInFlightForItem(id);
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    revokeResultUrls(item);

    set((state) => {
      const nextItems = new Map(state.items);
      nextItems.delete(id);
      return {
        items: nextItems,
        itemOrder: state.itemOrder.filter(i => i !== id),
      };
    });
  },

  clearFinished: () => {
    set((state) => {
      const nextItems = new Map<string, ImageItem>();
      const nextOrder: string[] = [];
      for (const id of state.itemOrder) {
        const item = state.items.get(id);
        if (!item) continue;
        if (item.status === STATUS_PROCESSING || item.status === STATUS_PENDING) {
          nextItems.set(id, item);
          nextOrder.push(id);
          continue;
        }
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        revokeResultUrls(item);
      }
      return { items: nextItems, itemOrder: nextOrder };
    });
  },

  clearAll: () => {
    const { items } = get();
    for (const item of items.values()) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      revokeResultUrls(item);
    }
    if (pool) pool.destroy();
    pool = null;
    set({ items: new Map(), itemOrder: [] });
  },

  reorderItems: (fromIndex, toIndex) => {
    set((state) => {
      if (
        fromIndex < 0 || toIndex < 0 ||
        fromIndex >= state.itemOrder.length || toIndex >= state.itemOrder.length ||
        fromIndex === toIndex
      ) return state;

      const nextOrder = [...state.itemOrder];
      const [removed] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, removed!);
      return { itemOrder: nextOrder };
    });
  },

  setItemOutputFormats: (id, formats, options) => {
    const currentPool = getPool(api);
    currentPool.abortInFlightForItem(id);
    currentPool.removeTasksForItem(id);

    set((state) => {
      const item = state.items.get(id);
      if (!item) return state;

      revokeResultUrls(item);
      const nextItem: ImageItem = {
        ...item,
        outputFormatsOverride: formats != null && formats.length > 0 ? formats : null,
        status: STATUS_PENDING,
        progress: 0,
        error: undefined,
      };

      const fmts = getFormatsToProcess(nextItem, options);
      const results: Record<string, ImageResult> = {};
      for (const f of fmts) {
        results[f] = { format: f, status: STATUS_PENDING };
      }
      nextItem.results = results;

      const nextItems = new Map(state.items);
      nextItems.set(id, nextItem);
      return { items: nextItems };
    });

    get()._processNext(options);
  },

  setItemQualityPercent: (id, percent, options) => {
    const clamped = percent == null
      ? null
      : Math.min(OUTPUT_QUALITY_MAX, Math.max(OUTPUT_QUALITY_MIN, Math.round(percent)));

    const currentPool = getPool(api);
    currentPool.abortInFlightForItem(id);
    currentPool.removeTasksForItem(id);

    set((state) => {
      const item = state.items.get(id);
      if (!item) return state;

      revokeResultUrls(item);
      const nextItem: ImageItem = {
        ...item,
        qualityPercentOverride: clamped,
        status: STATUS_PENDING,
        progress: 0,
        error: undefined,
      };

      const fmts = getFormatsToProcess(nextItem, options);
      const results: Record<string, ImageResult> = {};
      for (const f of fmts) {
        results[f] = { format: f, status: STATUS_PENDING };
      }
      nextItem.results = results;

      const nextItems = new Map(state.items);
      nextItems.set(id, nextItem);
      return { items: nextItems };
    });

    get()._processNext(options);
  },

  downloadAll: async () => {
    const { items, itemOrder } = get();
    const arr = itemsToArray(items, itemOrder);
    await buildAndDownloadZip(arr);
  },

  applyGlobalOptions: (options) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;

      set((state) => {
        const nextItems = new Map<string, ImageItem>();
        for (const [id, item] of state.items) {
          nextItems.set(id, resetItemResultsForOptions(item, options));
        }
        return { items: nextItems };
      });

      get()._processNext(options);
    }, UPDATE_OPTIONS_DEBOUNCE_MS);
  },

  _applyWorkerResult: (response) => {
    let shouldProcessNext = false;

    set((state) => {
      const item = state.items.get(response.id);
      if (!item) return state;

      const format = response.format;
      const result = item.results[format];
      if (!result) return state;

      const nextItem = { ...item };
      if (response.status === STATUS_SUCCESS) {
        if (result.downloadUrl) URL.revokeObjectURL(result.downloadUrl);
        const downloadUrl = URL.createObjectURL(response.blob);
        nextItem.results = {
          ...item.results,
          [format]: {
            ...result,
            status: STATUS_SUCCESS,
            size: response.size,
            blob: response.blob,
            label: response.label,
            downloadUrl,
            timing: response.timing,
          },
        };
      } else {
        nextItem.results = {
          ...item.results,
          [format]: { ...result, status: STATUS_ERROR, error: response.error },
        };
      }

      if (isTerminal(nextItem)) {
        const anyError = Object.values(nextItem.results).some(r => r.status === STATUS_ERROR);
        nextItem.status = anyError ? STATUS_ERROR : STATUS_SUCCESS;
        nextItem.progress = 100;
        shouldProcessNext = true;
      }

      const nextItems = new Map(state.items);
      nextItems.set(response.id, nextItem);
      return { items: nextItems };
    });

    if (shouldProcessNext) {
      get()._processNext(useSettingsStore.getState().options);
    }
  },

  _applyWorkerError: (task) => {
    if (!task) return;

    let shouldProcessNext = false;

    set((state) => {
      const item = state.items.get(task.id);
      if (!item) return state;

      const result = item.results[task.format];
      const nextItem = { ...item };
      if (result) {
        nextItem.results = {
          ...item.results,
          [task.format]: { ...result, status: STATUS_ERROR, error: ERR_WORKER },
        };
      }

      if (isTerminal(nextItem)) {
        nextItem.status = STATUS_ERROR;
        nextItem.progress = 100;
        shouldProcessNext = true;
      }

      const nextItems = new Map(state.items);
      nextItems.set(task.id, nextItem);
      return { items: nextItems };
    });

    if (shouldProcessNext) {
      get()._processNext(useSettingsStore.getState().options);
    }
  },

  _getPool: () => getPool(api),

  _processNext: (options) => {
    const { items, itemOrder } = get();

    // Find pending items
    const pendingIds = itemOrder.filter(id => {
      const item = items.get(id);
      return item?.status === STATUS_PENDING;
    });

    if (pendingIds.length === 0) return;

    // Sort by file size if enabled
    let sortedIds = pendingIds;
    if (options.smallFilesFirst) {
      sortedIds = [...pendingIds].sort((a, b) => {
        const itemA = items.get(a);
        const itemB = items.get(b);
        if (!itemA || !itemB) return 0;
        return itemA.originalSize - itemB.originalSize;
      });
    }

    const nextId = sortedIds[0];
    if (!nextId) return;
    const nextItem = items.get(nextId);
    if (!nextItem) return;

    // Mark as processing
    const processingItem: ImageItem = { ...nextItem, status: STATUS_PROCESSING };
    const fmts = getFormatsToProcess(processingItem, options);
    const currentPool = getPool(api);

    for (const format of fmts) {
      if (!processingItem.results[format]) continue;
      processingItem.results = {
        ...processingItem.results,
        [format]: { ...processingItem.results[format]!, status: STATUS_PROCESSING },
      };
      currentPool.addTask({
        id: processingItem.id,
        format,
        file: processingItem.file,
        options: {
          format,
          svgInternalFormat: options.svgInternalFormat,
          svgRasterizer: 'resvg' as const,
          svgExportDensity: 'display' as const,
          svgDisplayDpr: 2,
          qualityPercent: processingItem.qualityPercentOverride ?? 100,
          resizeMaxEdge: 0,
          stripMetadata: options.stripMetadata,
        },
      });
    }

    set((state) => {
      const nextItems = new Map(state.items);
      nextItems.set(nextId, processingItem);
      return { items: nextItems };
    });
  },
}));

// --- Selector helpers for components ---

export function selectItemById(id: string) {
  return (state: ImageStore) => state.items.get(id);
}

export function selectOrderedItems(state: ImageStore): ImageItem[] {
  return itemsToArray(state.items, state.itemOrder);
}

export function selectItemCount(state: ImageStore): number {
  return state.itemOrder.length;
}
