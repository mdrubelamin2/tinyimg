/**
 * Jotai-based actions for image state management.
 * These replace Zustand store actions.
 */

import { useSetAtom } from 'jotai';
import { useCallback, startTransition } from 'react';
import type { ImageItem, WorkerOutbound, Task } from '@/lib/queue/types';
import type { GlobalOptions } from '@/constants';
import {
  imageItemAtomFamily,
  itemOrderAtom,
  pendingIdsAtom,
  visibleItemIdsAtom,
} from './image-atoms';
import { collectItemsFromFiles } from '@/lib/queue/queue-intake';
import { createQueueItem, getFormatsToProcess } from '@/lib/queue/queue-item';
import { revokeResultUrls, buildAndDownloadZip } from '@/lib/download';
import { WorkerPool, computeConcurrency } from '@/workers/worker-pool-v2';
import OptimizerWorkerUrl from '@/workers/optimizer.worker.ts?worker&url';
import { STATUS_PENDING, STATUS_PROCESSING, STATUS_SUCCESS, STATUS_ERROR, STATUS_CHECKING } from '@/constants';
import { scheduleTask } from '@/lib/scheduler-polyfill';

// Import Jotai store from main.tsx
import { jotaiStore } from '@/main';

// Worker pool singleton
let pool: WorkerPool | null = null;

// Completion buffer for batching updates (2026 pattern)
const completionBuffer: WorkerOutbound[] = [];
let flushScheduled = false;

// Flush buffer with scheduler.yield() to prevent long tasks
async function flushCompletionBuffer() {
  if (completionBuffer.length === 0) {
    flushScheduled = false;
    return;
  }

  const batch = completionBuffer.splice(0, completionBuffer.length);

  startTransition(async () => {
    for (const response of batch) {
      // Yield to browser between updates to maintain 60fps
      if ('scheduler' in window && typeof (window.scheduler as { yield?: () => Promise<void> }).yield === 'function') {
        await (window.scheduler as { yield: () => Promise<void> }).yield();
      }

      processWorkerResponse(response);
    }
  });

  flushScheduled = false;
}

// Process individual worker response
function processWorkerResponse(response: WorkerOutbound) {
  // Handle ERROR type messages
  if (response.type === 'ERROR') {
    const itemAtom = imageItemAtomFamily(response.id);
    const currentItem = jotaiStore.get(itemAtom);

    if (!currentItem) return;

    const nextItem: ImageItem = {
      ...currentItem,
      results: {
        ...currentItem.results,
        [response.format]: {
          format: response.format,
          status: STATUS_ERROR,
          error: response.error,
        },
      },
    };

    // Check if all results are done
    const allDone = Object.values(nextItem.results).every(
      r => r.status === STATUS_SUCCESS || r.status === STATUS_ERROR
    );

    if (allDone) {
      nextItem.status = STATUS_ERROR;
      nextItem.error = response.error;

      // Remove from pending
      const pendingIds = jotaiStore.get(pendingIdsAtom);
      const nextPending = new Set(pendingIds);
      nextPending.delete(response.id);
      jotaiStore.set(pendingIdsAtom, nextPending);
    } else {
      nextItem.status = STATUS_PROCESSING;
    }

    // Use View Transitions API for smooth updates (2026 pattern)
    if ('startViewTransition' in document) {
      document.startViewTransition(() => {
        jotaiStore.set(itemAtom, nextItem);
      });
    } else {
      jotaiStore.set(itemAtom, nextItem);
    }
    return;
  }

  // Handle RESULT type messages
  if (response.type !== 'RESULT') return;

  const itemAtom = imageItemAtomFamily(response.id);
  const currentItem = jotaiStore.get(itemAtom);

  if (!currentItem) return;

  // Update item with result
  // downloadUrl is now created in worker thread (2026 pattern - zero main thread blocking)
  const nextItem: ImageItem = {
    ...currentItem,
    results: {
      ...currentItem.results,
      [response.format]: {
        format: response.format,
        status: STATUS_SUCCESS,
        size: response.size,
        blob: response.blob,
        downloadUrl: response.downloadUrl || null, // Created in worker
        error: undefined,
        savingsPercent: response.savingsPercent,
        formattedSize: response.formattedSize,
        label: response.label,
      },
    },
  };

  // Check if all results are done
  const allDone = Object.values(nextItem.results).every(
    r => r.status === STATUS_SUCCESS || r.status === STATUS_ERROR
  );

  if (allDone) {
    nextItem.status = Object.values(nextItem.results).some(r => r.status === STATUS_ERROR)
      ? STATUS_ERROR
      : STATUS_SUCCESS;

    // Remove from pending
    const pendingIds = jotaiStore.get(pendingIdsAtom);
    const nextPending = new Set(pendingIds);
    nextPending.delete(response.id);
    jotaiStore.set(pendingIdsAtom, nextPending);
  } else {
    nextItem.status = STATUS_PROCESSING;
  }

  // Use View Transitions API for smooth updates (2026 pattern)
  if ('startViewTransition' in document) {
    document.startViewTransition(() => {
      jotaiStore.set(itemAtom, nextItem);
    });
  } else {
    jotaiStore.set(itemAtom, nextItem);
  }
}

function getPool(): WorkerPool {
  if (pool) return pool;

  const workerUrl = new URL(OptimizerWorkerUrl, import.meta.url);
  pool = new WorkerPool(workerUrl, computeConcurrency(), {
    onMessage: (_workerIndex, data) => {
      const response = data as WorkerOutbound;

      // Add to completion buffer for batching
      completionBuffer.push(response);

      // Schedule flush if not already scheduled (batch updates every 16ms = 1 frame)
      if (!flushScheduled) {
        flushScheduled = true;
        scheduleTask(flushCompletionBuffer, { priority: 'user-visible' }).catch(() => {
          // Fallback: flush immediately if scheduling fails
          void flushCompletionBuffer();
        });
      }
    },
    onError: (_workerIndex, task: Task | null) => {
      if (!task) return;

      const itemAtom = imageItemAtomFamily(task.id);
      const currentItem = jotaiStore.get(itemAtom);

      if (!currentItem) return;

      const nextItem: ImageItem = {
        ...currentItem,
        status: STATUS_ERROR,
        error: 'Worker error',
      };

      jotaiStore.set(itemAtom, nextItem);

      // Remove from pending
      const pendingIds = jotaiStore.get(pendingIdsAtom);
      const nextPending = new Set(pendingIds);
      nextPending.delete(task.id);
      jotaiStore.set(pendingIdsAtom, nextPending);
    },
  });

  return pool;
}

// --- Action hooks ---

export function useAddFiles() {
  const setItemOrder = useSetAtom(itemOrderAtom);
  const setPendingIds = useSetAtom(pendingIdsAtom);

  return useCallback(async (files: FileList | File[] | DataTransferItemList | DataTransferItem[], options: GlobalOptions) => {
    // Start collecting items asynchronously
    collectItemsFromFiles(files, {
      createItem: (file: File) => createQueueItem(file, options),
      onDimensionCheckComplete: (item: ImageItem, error: string | null) => {
        if (!jotaiStore) return;

        const itemAtom = imageItemAtomFamily(item.id);
        const currentItem = jotaiStore.get(itemAtom);
        if (!currentItem) return;

        if (error) {
          // Dimension check failed - mark as error
          jotaiStore.set(itemAtom, {
            ...currentItem,
            status: STATUS_ERROR,
            error,
          });
          // Remove from pending
          setPendingIds((prev: Set<string>) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        } else {
          // Dimension check passed - mark as pending and start processing
          jotaiStore.set(itemAtom, {
            ...currentItem,
            status: STATUS_PENDING,
          });
          processNext(options);
        }
      },
    }).then(newItems => {
      if (!jotaiStore || newItems.length === 0) return;

      const newIds = newItems.map(i => i.id);

      // Batch all state updates together
      startTransition(() => {
        // Set individual item atoms FIRST
        for (const item of newItems) {
          const itemAtom = imageItemAtomFamily(item.id);
          jotaiStore.set(itemAtom, item);
        }

        // Then update order and pending
        setItemOrder(prev => [...prev, ...newIds]);
        setPendingIds((prev: Set<string>) => {
          const next = new Set(prev);
          newIds.forEach(id => next.add(id));
          return next;
        });
      });
    });

    // Don't wait - return immediately so UI stays responsive
  }, [setItemOrder, setPendingIds]);
}

export function useRemoveItem() {
  const setItemOrder = useSetAtom(itemOrderAtom);
  const setPendingIds = useSetAtom(pendingIdsAtom);

  return useCallback((id: string) => {
    if (!jotaiStore) return;

    const itemAtom = imageItemAtomFamily(id);
    const item = jotaiStore.get(itemAtom);

    if (!item) return;

    // Abort worker tasks
    getPool().abortInFlightForItem(id);

    // Revoke URLs
    revokeResultUrls(item);

    // Remove from state
    jotaiStore.set(itemAtom, null);
    setItemOrder(prev => prev.filter(i => i !== id));
    setPendingIds((prev: Set<string>) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [setItemOrder, setPendingIds]);
}

export function useClearFinished() {
  const setItemOrder = useSetAtom(itemOrderAtom);
  const setPendingIds = useSetAtom(pendingIdsAtom);

  return useCallback(() => {
    if (!jotaiStore) return;

    const order = jotaiStore.get(itemOrderAtom);
    const nextOrder: string[] = [];
    const nextPending = new Set<string>();

    for (const id of order) {
      const itemAtom = imageItemAtomFamily(id);
      const item = jotaiStore.get(itemAtom);

      if (!item) continue;

      if (item.status === STATUS_PROCESSING || item.status === STATUS_PENDING || item.status === STATUS_CHECKING) {
        nextOrder.push(id);
        if (item.status === STATUS_PENDING) {
          nextPending.add(id);
        }
      } else {
        // Clean up finished item
        revokeResultUrls(item);
        jotaiStore.set(itemAtom, null);
      }
    }

    setItemOrder(nextOrder);
    setPendingIds(nextPending);
  }, [setItemOrder, setPendingIds]);
}

export function useClearAll() {
  const setItemOrder = useSetAtom(itemOrderAtom);
  const setPendingIds = useSetAtom(pendingIdsAtom);

  return useCallback(() => {
    if (!jotaiStore) return;

    const order = jotaiStore.get(itemOrderAtom);

    for (const id of order) {
      const itemAtom = imageItemAtomFamily(id);
      const item = jotaiStore.get(itemAtom);

      if (item) {
        revokeResultUrls(item);
      }

      jotaiStore.set(itemAtom, null);
    }

    if (pool) {
      pool.destroy();
      pool = null;
    }

    setItemOrder([]);
    setPendingIds(new Set());
  }, [setItemOrder, setPendingIds]);
}

export function useDownloadAll() {
  return useCallback(async () => {
    const itemOrder = jotaiStore.get(itemOrderAtom);
    const items: ImageItem[] = [];

    for (const id of itemOrder) {
      const itemAtom = imageItemAtomFamily(id);
      const item = jotaiStore.get(itemAtom);
      if (item) items.push(item);
    }

    await buildAndDownloadZip(items);
  }, []);
}

export function useApplyGlobalOptions() {
  const setPendingIds = useSetAtom(pendingIdsAtom);

  return useCallback((options: GlobalOptions) => {
    if (!jotaiStore) return;

    const itemOrder = jotaiStore.get(itemOrderAtom);
    const nextPending = new Set<string>();

    for (const id of itemOrder) {
      const itemAtom = imageItemAtomFamily(id);
      const item = jotaiStore.get(itemAtom);

      if (!item) continue;

      // Get formats that should be processed with new options
      const newFormats = getFormatsToProcess(item, options);
      const existingFormats = Object.keys(item.results);

      // Find formats that need to be added (not already processed)
      const formatsToAdd = newFormats.filter(f => !existingFormats.includes(f));

      // If no new formats, skip this item
      if (formatsToAdd.length === 0) continue;

      // Add new format results as pending
      const updatedResults = { ...item.results };
      for (const format of formatsToAdd) {
        updatedResults[format] = { format, status: STATUS_PENDING };
      }

      const updatedItem: ImageItem = {
        ...item,
        results: updatedResults,
        status: STATUS_PENDING, // Mark as pending since we have new work
      };

      jotaiStore.set(itemAtom, updatedItem);
      nextPending.add(id);
    }

    // Update pending IDs
    setPendingIds((prev: Set<string>) => {
      const combined = new Set(prev);
      nextPending.forEach(id => combined.add(id));
      return combined;
    });

    // Start processing
    if (nextPending.size > 0) {
      processNext(options);
    }
  }, [setPendingIds]);
}

// Internal: process next pending items
function processNext(options: GlobalOptions) {
  const pendingIds = jotaiStore.get(pendingIdsAtom);
  const visibleIds = jotaiStore.get(visibleItemIdsAtom);

  const pendingArray = Array.from(pendingIds);

  // Sort by visibility and size
  const sortedIds = pendingArray.sort((a, b) => {
    const aVisible = visibleIds.has(a);
    const bVisible = visibleIds.has(b);

    if (aVisible && !bVisible) return -1;
    if (!aVisible && bVisible) return 1;

    if (options.smallFilesFirst) {
      const itemA = jotaiStore.get(imageItemAtomFamily(a));
      const itemB = jotaiStore.get(imageItemAtomFamily(b));

      if (!itemA || !itemB) return 0;
      return itemA.originalSize - itemB.originalSize;
    }

    return 0;
  });

  const currentPool = getPool();

  for (const id of sortedIds) {
    const itemAtom = imageItemAtomFamily(id);
    const item = jotaiStore.get(itemAtom);

    if (!item) continue;

    const formats = getFormatsToProcess(item, options);

    for (const format of formats) {
      const result = item.results[format];
      if (!result || result.status !== STATUS_PENDING) continue;

      currentPool.addTask({
        id: item.id,
        file: item.file,
        format,
        options: {
          format,
          stripMetadata: options.stripMetadata,
          svgInternalFormat: options.svgInternalFormat,
          svgRasterizer: 'resvg',
          svgExportDensity: 'display',
          svgDisplayDpr: window.devicePixelRatio || 1,
          qualityPercent: 85,
          resizeMaxEdge: 0,
        },
      });
    }
  }
}
