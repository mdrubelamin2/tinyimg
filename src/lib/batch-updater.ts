/**
 * Batch state updater for worker results.
 * Collects multiple worker results and applies them in a single batch
 * to avoid flooding the main thread with individual state updates.
 */

import { startTransition } from 'react';

interface BatchUpdate<T> {
  id: string;
  data: T;
  timestamp: number;
}

export class BatchUpdater<T> {
  private queue: BatchUpdate<T>[] = [];
  private timeoutId: number | null = null;
  private readonly batchDelay: number;
  private readonly maxBatchSize: number;
  private readonly onFlush: (updates: BatchUpdate<T>[]) => void;

  constructor(
    onFlush: (updates: BatchUpdate<T>[]) => void,
    options: {
      batchDelay?: number;
      maxBatchSize?: number;
    } = {}
  ) {
    this.onFlush = onFlush;
    this.batchDelay = options.batchDelay ?? 16; // ~1 frame (60fps)
    this.maxBatchSize = options.maxBatchSize ?? 50;
  }

  /**
   * Add an update to the batch queue.
   * Automatically flushes when batch is full or after delay.
   */
  add(id: string, data: T): void {
    this.queue.push({
      id,
      data,
      timestamp: Date.now(),
    });

    // Flush immediately if batch is full
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
      return;
    }

    // Schedule delayed flush
    if (this.timeoutId === null) {
      this.timeoutId = window.setTimeout(() => {
        this.flush();
      }, this.batchDelay);
    }
  }

  /**
   * Flush all pending updates immediately.
   */
  flush(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.queue.length === 0) return;

    const updates = this.queue.slice();
    this.queue = [];

    // Use startTransition to mark updates as non-urgent
    // This allows React to prioritize user interactions over state updates
    startTransition(() => {
      this.onFlush(updates);
    });
  }

  /**
   * Clear all pending updates without flushing.
   */
  clear(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.queue = [];
  }

  /**
   * Get current queue size.
   */
  get size(): number {
    return this.queue.length;
  }
}
