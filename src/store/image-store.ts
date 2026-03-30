/**
 * Image store: Zustand-based queue state management.
 * Replaces the QueueProcessor God Class with composable actions.
 */

import { create } from 'zustand';
import { startTransition } from 'react';
import type { ImageItem, ImageResult, Task, WorkerOutbound } from '@/lib/queue/types';
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
import { PriorityWorkerPool } from '@/lib/worker-pool-priority';
import { collectItemsFromFilesStreaming } from '@/lib/queue/queue-intake-streaming';
import {
  getFormatsToProcess,
  resetItemResultsForOptions,
} from '@/lib/queue/queue-item';
import { revokeResultUrls, buildAndDownloadZip } from '@/lib/download';
import OptimizerWorkerUrl from '@/workers/optimizer.worker.ts?worker&url';
import { useSettingsStore } from './settings-store';
import { opfsManager } from '@/lib/opfs/opfs-manager';
import { thumbnailCache } from '@/lib/opfs/thumbnail-cache';
import { useVisibilityStore } from './visibility-store';

interface ImageStoreState {
  items: Map<string, ImageItem>;
  itemOrder: string[];
  pendingIds: Set<string>;
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
  applyGlobalOptions: (options: GlobalOptions, forceAll?: boolean) => void;
  _applyWorkerResult: (response: WorkerOutbound) => void;
  _applyWorkerError: (task: Task | null) => void;
  _batchApplyResults: () => void;
  _getPool: () => PriorityWorkerPool;
  _processNext: (options: GlobalOptions) => void;
}

export type ImageStore = ImageStoreState & ImageStoreActions;

let pool: PriorityWorkerPool | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingForceAll = false;

let responseBuffer: WorkerOutbound[] = [];
let errorBuffer: (Task | null)[] = [];
let flushScheduled = false;

function getPool(storeApi: { getState: () => ImageStore }): PriorityWorkerPool {
  if (pool) return pool;
  const workerUrl = new URL(OptimizerWorkerUrl, import.meta.url);
  pool = new PriorityWorkerPool(workerUrl, {
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

export const useImageStore = create<ImageStore>()((set, get, api) => ({
  items: new Map(),
  itemOrder: [],
  pendingIds: new Set(),

  addFiles: async (files, options) => {
    await opfsManager.initialize();
    
    const newItems = await collectItemsFromFilesStreaming(files, {
      createItem: (metadata) => {
        const item: ImageItem = {
          id: metadata.id,
          fileHandle: metadata.handle,
          fileName: metadata.name,
          fileSize: metadata.size,
          status: STATUS_PENDING,
          progress: 0,
          originalSize: metadata.size,
          originalFormat: metadata.name.split('.').pop()?.toLowerCase() ?? 'unknown',
          results: {},
        };
        const formats = getFormatsToProcess(item, options);
        for (const format of formats) {
          item.results[format] = { format, status: STATUS_PENDING };
        }
        return item;
      },
    });

    set((state) => {
      const nextItems = new Map(state.items);
      const nextOrder = [...state.itemOrder];
      const nextPending = new Set(state.pendingIds);
      for (const item of newItems) {
        nextItems.set(item.id, item);
        nextOrder.push(item.id);
        nextPending.add(item.id);
      }
      return { items: nextItems, itemOrder: nextOrder, pendingIds: nextPending };
    });

    get()._processNext(options);
  },

  removeItem: (id) => {
    const item = get().items.get(id);
    if (!item) return;

    getPool(api).abortInFlightForItem(id);
    
    if (item.fileHandle) {
      opfsManager.deleteFile(item.fileHandle).catch(console.error);
    }
    thumbnailCache.delete(id);
    revokeResultUrls(item);

    set((state) => {
      const nextItems = new Map(state.items);
      nextItems.delete(id);
      const nextPending = new Set(state.pendingIds);
      nextPending.delete(id);
      return {
        items: nextItems,
        itemOrder: state.itemOrder.filter(i => i !== id),
        pendingIds: nextPending,
      };
    });
  },

  clearFinished: () => {
    set((state) => {
      const nextItems = new Map<string, ImageItem>();
      const nextOrder: string[] = [];
      const nextPending = new Set<string>();
      for (const id of state.itemOrder) {
        const item = state.items.get(id);
        if (!item) continue;
        if (item.status === STATUS_PROCESSING || item.status === STATUS_PENDING) {
          nextItems.set(id, item);
          nextOrder.push(id);
          if (item.status === STATUS_PENDING) {
            nextPending.add(id);
          }
          continue;
        }
        
        if (item.fileHandle) {
          opfsManager.deleteFile(item.fileHandle).catch(console.error);
        }
        thumbnailCache.delete(id);
        revokeResultUrls(item);
      }
      return { items: nextItems, itemOrder: nextOrder, pendingIds: nextPending };
    });
  },

  clearAll: () => {
    const { items } = get();
    for (const item of items.values()) {
      if (item.fileHandle) {
        opfsManager.deleteFile(item.fileHandle).catch(console.error);
      }
      thumbnailCache.delete(item.id);
      revokeResultUrls(item);
    }
    if (pool) pool.destroy();
    pool = null;
    thumbnailCache.clear();
    set({ items: new Map(), itemOrder: [], pendingIds: new Set() });
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
      const nextPending = new Set(state.pendingIds);
      nextPending.add(id);
      return {
        items: nextItems,
        pendingIds: nextPending,
      };
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
      const nextPending = new Set(state.pendingIds);
      nextPending.add(id);
      return {
        items: nextItems,
        pendingIds: nextPending,
      };
    });

    get()._processNext(options);
  },

  downloadAll: async () => {
    const { items, itemOrder } = get();
    const arr = itemsToArray(items, itemOrder);
    await buildAndDownloadZip(arr);
  },

  applyGlobalOptions: (options, forceAll = false) => {
    if (forceAll) pendingForceAll = true;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const isForced = pendingForceAll;
      pendingForceAll = false;
      debounceTimer = null;

      set((state) => {
        const nextItems = new Map<string, ImageItem>();
        const nextPending = new Set<string>();
        for (const [id, item] of state.items) {
          if (isForced || item.status === STATUS_PENDING || item.status === STATUS_PROCESSING) {
            const nextItem = resetItemResultsForOptions(item, options);
            nextItems.set(id, nextItem);
            nextPending.add(id);
          } else {
            nextItems.set(id, item);
          }
        }
        return { items: nextItems, pendingIds: nextPending };
      });

      get()._processNext(options);
    }, UPDATE_OPTIONS_DEBOUNCE_MS);
  },

  _applyWorkerResult: (response: WorkerOutbound) => {
    responseBuffer.push(response);
    if (!flushScheduled) {
      flushScheduled = true;
      requestAnimationFrame(() => {
        get()._batchApplyResults();
      });
    }
  },

  _applyWorkerError: (task: Task | null) => {
    errorBuffer.push(task);
    if (!flushScheduled) {
      flushScheduled = true;
      requestAnimationFrame(() => {
        get()._batchApplyResults();
      });
    }
  },

  _batchApplyResults: () => {
    const responses = [...responseBuffer] as WorkerOutbound[];
    const errors = [...errorBuffer];
    responseBuffer = [];
    errorBuffer = [];
    flushScheduled = false;

    if (responses.length === 0 && errors.length === 0) return;

    let shouldProcessNext = false;

    startTransition(() => {
      set((state) => {
        const nextItems = new Map(state.items);
        const nextPending = new Set(state.pendingIds);

        for (const response of responses) {
          if (response.type === 'RESULT') {
            const item = nextItems.get(response.id);
            if (!item) continue;

            const format = response.format;
            const result = item.results[format];
            if (!result) continue;

            const nextItem = { ...item };
            if (result.downloadUrl) URL.revokeObjectURL(result.downloadUrl);
            const downloadUrl = URL.createObjectURL(response.blob);

            nextItem.results = {
              ...item.results,
              [format]: {
                ...result,
                status: STATUS_SUCCESS,
                size: response.size,
                formattedSize: response.formattedSize,
                savingsPercent: response.savingsPercent,
                blob: response.blob,
                label: response.label,
                downloadUrl,
                timing: response.timing,
              },
            };

            if (isTerminal(nextItem)) {
              const anyError = Object.values(nextItem.results).some(r => r.status === STATUS_ERROR);
              nextItem.status = anyError ? STATUS_ERROR : STATUS_SUCCESS;
              nextItem.progress = 100;
              nextPending.delete(response.id);
              shouldProcessNext = true;
            }

            nextItems.set(response.id, nextItem);
          }
        }

        for (const task of errors) {
          if (!task) continue;
          const item = nextItems.get(task.id);
          if (!item) continue;

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
            nextPending.delete(task.id);
            shouldProcessNext = true;
          }

          nextItems.set(task.id, nextItem);
        }

        return { items: nextItems, pendingIds: nextPending };
      });

      if (shouldProcessNext) {
        get()._processNext(useSettingsStore.getState().options);
      }
    });
  },

  _getPool: () => getPool(api),

  _processNext: async (options) => {
    const { items, itemOrder, pendingIds } = get();
    const visibleItemIds = useVisibilityStore.getState().visibleItemIds;

    if (pendingIds.size === 0) return;

    const currentPendingArray = itemOrder.filter(id => pendingIds.has(id));
    if (currentPendingArray.length === 0) return;

    const sortedIds = [...currentPendingArray].sort((a, b) => {
      const aVisible = visibleItemIds.has(a);
      const bVisible = visibleItemIds.has(b);

      if (aVisible && !bVisible) return -1;
      if (!aVisible && bVisible) return 1;

      if (options.smallFilesFirst) {
        const itemA = items.get(a);
        const itemB = items.get(b);
        if (!itemA || !itemB) return 0;
        return itemA.fileSize - itemB.fileSize;
      }

      return 0;
    });

    const nextId = sortedIds[0];
    if (!nextId) return;
    const nextItem = items.get(nextId);
    if (!nextItem || nextItem.status !== STATUS_PENDING) return;

    const processingItem: ImageItem = { ...nextItem, status: STATUS_PROCESSING };
    const fmts = getFormatsToProcess(processingItem, options);
    const currentPool = getPool(api);

    const file = await opfsManager.readFile(nextItem.fileHandle);

    for (const format of fmts) {
      if (!processingItem.results[format]) continue;
      processingItem.results = {
        ...processingItem.results,
        [format]: { ...processingItem.results[format]!, status: STATUS_PROCESSING },
      };
      currentPool.addTask({
        id: processingItem.id,
        format,
        file,
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
      const nextPending = new Set(state.pendingIds);
      nextItems.set(nextId, processingItem);
      nextPending.delete(nextId);
      return { items: nextItems, pendingIds: nextPending };
    });
  },
}));

export function selectItemById(id: string) {
  return (state: ImageStore) => state.items.get(id);
}

export function selectOrderedItems(state: ImageStore): ImageItem[] {
  return itemsToArray(state.items, state.itemOrder);
}

export function selectItemCount(state: ImageStore): number {
  return state.itemOrder.length;
}