/**
 * Progressive rendering utilities
 * Render items in batches to prevent blocking the main thread
 */

import { yieldToMain } from './scheduler-polyfill';

export interface ProgressiveRenderOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  onBatchComplete?: (batchIndex: number, totalBatches: number) => void;
}

/**
 * Render items progressively in batches
 * Yields to the main thread between batches to keep UI responsive
 */
export async function renderProgressively<T>(
  items: T[],
  renderFn: (item: T, index: number) => void | Promise<void>,
  options: ProgressiveRenderOptions = {}
): Promise<void> {
  const {
    batchSize = 10,
    delayBetweenBatches = 0,
    onBatchComplete,
  } = options;

  const totalBatches = Math.ceil(items.length / batchSize);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, items.length);
    const batch = items.slice(start, end);

    // Render batch
    for (let i = 0; i < batch.length; i++) {
      await renderFn(batch[i]!, start + i);
    }

    // Notify batch completion
    onBatchComplete?.(batchIndex, totalBatches);

    // Yield to main thread between batches
    if (batchIndex < totalBatches - 1) {
      if (delayBetweenBatches > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      } else {
        await yieldToMain();
      }
    }
  }
}

/**
 * Create a progressive renderer that can be paused/resumed
 */
export class ProgressiveRenderer<T> {
  private items: T[];
  private renderFn: (item: T, index: number) => void | Promise<void>;
  private batchSize: number;
  private currentIndex = 0;
  private isPaused = false;
  private isRunning = false;
  private onProgress?: ((current: number, total: number) => void) | undefined;

  constructor(
    items: T[],
    renderFn: (item: T, index: number) => void | Promise<void>,
    options: {
      batchSize?: number;
      onProgress?: (current: number, total: number) => void;
    } = {}
  ) {
    this.items = items;
    this.renderFn = renderFn;
    this.batchSize = options.batchSize || 10;
    this.onProgress = options.onProgress;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;

    while (this.currentIndex < this.items.length && !this.isPaused) {
      const batchEnd = Math.min(
        this.currentIndex + this.batchSize,
        this.items.length
      );

      // Render batch
      for (let i = this.currentIndex; i < batchEnd; i++) {
        if (this.isPaused) break;
        await this.renderFn(this.items[i]!, i);
        this.currentIndex = i + 1;
      }

      // Report progress
      this.onProgress?.(this.currentIndex, this.items.length);

      // Yield to main thread
      if (this.currentIndex < this.items.length && !this.isPaused) {
        await yieldToMain();
      }
    }

    this.isRunning = false;
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    void this.start();
  }

  reset(): void {
    this.currentIndex = 0;
    this.isPaused = false;
    this.isRunning = false;
  }

  getProgress(): { current: number; total: number; percentage: number } {
    return {
      current: this.currentIndex,
      total: this.items.length,
      percentage: (this.currentIndex / this.items.length) * 100,
    };
  }
}
