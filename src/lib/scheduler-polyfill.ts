/**
 * Scheduler API helpers with polyfill.
 * Uses scheduler-polyfill package for browser compatibility.
 */

// Import the polyfill to ensure scheduler global is available
import 'scheduler-polyfill';

export type TaskPriority = 'user-blocking' | 'user-visible' | 'background';

interface SchedulerPostTaskOptions {
  priority?: TaskPriority;
  delay?: number;
  signal?: AbortSignal;
}

/**
 * Priority-based task scheduling.
 * Uses native/polyfilled scheduler.postTask.
 */
export const scheduleTask = <T>(
  callback: () => T,
  options: SchedulerPostTaskOptions = {}
): Promise<T> => {
  return scheduler.postTask(callback, options);
};

/**
 * Yield control back to the browser to prevent blocking.
 * Uses native/polyfilled scheduler.yield.
 */
export const yieldToMain = (): Promise<void> => {
  return scheduler.yield();
};

/**
 * Process items in batches with yielding to prevent blocking.
 * Automatically yields to the browser between batches.
 */
export async function processBatched<T>(
  items: T[],
  processor: (item: T, index: number) => void | Promise<void>,
  batchSize = 10
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    for (let j = 0; j < batch.length; j++) {
      await processor(batch[j]!, i + j);
    }

    // Yield to browser after each batch
    if (i + batchSize < items.length) {
      await yieldToMain();
    }
  }
}

/**
 * Check if native Scheduler API is available.
 */
export const hasSchedulerAPI = (): boolean => {
  return typeof scheduler !== 'undefined' &&
    typeof scheduler.postTask === 'function' &&
    typeof scheduler.yield === 'function';
};
