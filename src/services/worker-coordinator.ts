import { batch, observe } from '@legendapp/state';
import { WorkerPool, computeConcurrency } from '@/workers/worker-pool-v2';
import {
  STATUS_PROCESSING,
  STATUS_SUCCESS,
  STATUS_ERROR,
  ERR_WORKER,
} from '@/constants';
import {
  imageStore$,
  poolStats$,
  inFlightTasks$,
  pendingTasks$,
  isLargeFileInFlight$,
  intake$
} from '@/store/queue-store';
import { resolveOriginalSourceFile } from '@/storage/queue-binary';
import { buildOutputSlots } from '@/lib/queue/output-slots';
import type { Task, WorkerOutbound, ImageItem, ImageResult } from '@/lib/queue/types';
import type { GlobalOptions } from '@/constants';
import { schedulePersistWorkerResults } from './storage-sync';
import { useSettingsStore } from '@/store/settings-store';

let pool: WorkerPool | null = null;
let responseBuffer: WorkerOutbound[] = [];
let errorBuffer: (Task | null)[] = [];
let flushScheduled = false;
let isScheduling = false;

function isTerminal(item: ImageItem): boolean {
  return !Object.values(item.results).some(
    r => r.status === 'processing' || r.status === 'pending'
  );
}

export function getPool(): WorkerPool {
  if (pool) return pool;
  pool = new WorkerPool(computeConcurrency(), {
    onMessage: (_workerIndex, data) => {
      applyWorkerResult(data as WorkerOutbound);
    },
    onError: (_workerIndex, task) => {
      applyWorkerError(task);
    },
    onActiveCountChange: (count) => {
      batch(() => {
        poolStats$.activeCount.set(count);
        if (pool) {
          poolStats$.limit.set(pool.concurrencyLimit);
        }
      });
    }
  });
  return pool;
}

export function applyWorkerResult(response: WorkerOutbound): void {
  if (response.type === 'RESULT') {
    schedulePersistWorkerResults([response]);
    return;
  }

  responseBuffer.push(response);
  if (!flushScheduled) {
    flushScheduled = true;
    requestAnimationFrame(() => {
      batchApplyResults();
    });
  }
}

export function applyWorkerError(task: Task | null): void {
  errorBuffer.push(task);
  if (!flushScheduled) {
    flushScheduled = true;
    requestAnimationFrame(() => {
      batchApplyResults();
    });
  }
}

export function batchApplyResults(): void {
  const responses = [...responseBuffer];
  const errors = [...errorBuffer];
  responseBuffer = [];
  errorBuffer = [];
  flushScheduled = false;

  if (responses.length === 0 && errors.length === 0) return;

  batch(() => {
    for (const response of responses) {
      if (response.type === 'ERROR') {
        const item = imageStore$.items[response.id]?.peek();
        if (!item) continue;

        const rid = response.resultId;
        const prev = item.results[rid];
        const nextItem = { ...item };
        const merged: ImageResult = {
          ...(prev ?? {
            resultId: rid,
            format: response.format,
            variantLabel: '',
            status: STATUS_PROCESSING,
          }),
          resultId: rid,
          format: response.format,
          status: STATUS_ERROR,
          error: response.error,
        };
        nextItem.results = {
          ...item.results,
          [rid]: merged,
        };

        if (isTerminal(nextItem)) {
          nextItem.status = STATUS_ERROR;
          nextItem.progress = 100;
        }

        imageStore$.items[response.id]!.set(nextItem);
        inFlightTasks$[`${response.id}:${rid}`]?.delete();
      }
    }

    for (const task of errors) {
      if (!task) continue;
      const item = imageStore$.items[task.id]?.peek();
      if (!item) continue;

      const rid = task.resultId;
      const prev = item.results[rid];
      const nextItem = { ...item };
      const merged: ImageResult = {
        ...(prev ?? {
          resultId: rid,
          format: task.format,
          variantLabel: '',
          status: STATUS_PROCESSING,
        }),
        resultId: rid,
        format: task.format,
        status: STATUS_ERROR,
        error: ERR_WORKER,
      };
      nextItem.results = {
        ...item.results,
        [rid]: merged,
      };

      if (isTerminal(nextItem)) {
        nextItem.status = STATUS_ERROR;
        nextItem.progress = 100;
      }

      imageStore$.items[task.id]!.set(nextItem);
      inFlightTasks$[`${task.id}:${rid}`]?.delete();
    }
  });
}

export async function processNextAsync(options: GlobalOptions): Promise<void> {
  if (isScheduling) return;
  isScheduling = true;

  try {
    const currentPool = getPool();
    const inFlightCount = Object.keys(inFlightTasks$.peek()).length;
    const limit = poolStats$.limit.peek();
    const remainingCapacity = limit - inFlightCount;

    if (remainingCapacity <= 0) return;

    const pending = pendingTasks$.peek();
    if (pending.length === 0) return;

    const isLargeBusy = isLargeFileInFlight$.peek();
    if (isLargeBusy) return;

    const items = imageStore$.items.peek();
    let capacity = remainingCapacity;

    const tasksByItem = new Map<string, { resultIds: string[]; isLarge: boolean }>();
    for (const p of pending) {
      if (!tasksByItem.has(p.itemId)) {
        tasksByItem.set(p.itemId, { resultIds: [], isLarge: p.isLarge });
      }
      tasksByItem.get(p.itemId)!.resultIds.push(p.resultId);
    }

    for (const [itemId, info] of tasksByItem) {
      if (capacity <= 0) break;

      const item = items[itemId];
      if (!item) continue;

      if (info.isLarge) {
        if (inFlightCount > 0 || capacity < remainingCapacity) {
          break;
        }
        const sourceFile = await resolveOriginalSourceFile(itemId, item);
        if (!sourceFile) continue;

        const toDispatch = info.resultIds.slice(0, Math.min(2, capacity));
        const count = dispatchRowToPool(itemId, item, sourceFile, currentPool, options, toDispatch);
        capacity -= count;
        break;
      }

      const sourceFile = await resolveOriginalSourceFile(itemId, item);
      if (!sourceFile) continue;

      const toDispatch = info.resultIds.slice(0, capacity);
      const count = dispatchRowToPool(itemId, item, sourceFile, currentPool, options, toDispatch);

      capacity -= count;
    }
  } finally {
    isScheduling = false;
  }
}

function dispatchRowToPool(
  id: string,
  candidateItem: ImageItem,
  sourceFile: File,
  currentPool: WorkerPool,
  options: GlobalOptions,
  resultIds: string[]
): number {
  const processingItem: ImageItem = { ...candidateItem, status: STATUS_PROCESSING };
  let dispatchedCount = 0;

  const slots = buildOutputSlots(processingItem, options);

  batch(() => {
    for (const rid of resultIds) {
      const res = processingItem.results[rid];
      if (!res || res.status === STATUS_SUCCESS || res.status === STATUS_PROCESSING) continue;

      const slot = slots.find(s => s.resultId === rid);
      if (!slot) continue;

      const task: Task = {
        id: processingItem.id,
        resultId: rid,
        format: slot.format,
        file: sourceFile,
        options: {
          resultId: rid,
          format: slot.format,
          originalExtension: processingItem.originalFormat,
          originalSize: processingItem.originalSize,
          svgInternalFormat: options.svgInternalFormat,
          svgRasterizer: 'resvg' as const,
          svgExportDensity: 'display' as const,
          svgDisplayDpr: 2,
          qualityPercent: processingItem.qualityPercentOverride ?? options.qualityPercent,
          resizePreset: slot.resizePreset,
          stripMetadata: options.stripMetadata,
          losslessEncoding: options.losslessEncoding,
        },
      };

      currentPool.addTask(task);
      processingItem.results = {
        ...processingItem.results,
        [rid]: { ...res, status: STATUS_PROCESSING },
      };
      inFlightTasks$[`${id}:${rid}`]!.set(true);
      dispatchedCount++;
    }

    imageStore$.items[id]!.set(processingItem);
  });

  return dispatchedCount;
}

export async function destroyPool() {
  if (pool) {
    await pool.destroy();
    pool = null;
  }
}

// Reactive queue scheduler
observe(() => {
  const pending = pendingTasks$.get();
  const inFlightCount = Object.keys(inFlightTasks$.get()).length;
  const limit = poolStats$.limit.get();
  const isLargeBusy = isLargeFileInFlight$.get();
  const isIntakeActive = intake$.active.get();

  if (pending.length > 0 && inFlightCount < limit && !isLargeBusy && !isIntakeActive) {
    void processNextAsync(useSettingsStore.getState().options);
  }
});
