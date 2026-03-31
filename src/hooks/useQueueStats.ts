/**
 * Derive queue stats from items: savings percent, all-done, has-finished, successful count.
 */

import { useMemo } from 'react';
import type { ImageItem } from '@/lib/queue/types';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_PROCESSING } from '@/constants/index';

export interface QueueStats {
  savingsPercent: string;
  allDone: boolean;
  successfulCount: number;
  hasFinishedItems: boolean;
  processingCount: number;
  doneCount: number;
}

export function useQueueStats(items: ImageItem[]): QueueStats {
  return useMemo(() => {
    let totalOriginal = 0;
    let totalOptimized = 0;
    let successfulCount = 0;
    let processingCount = 0;
    let hasFinishedItems = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;

      totalOriginal += item.originalSize;

      if (item.status === STATUS_SUCCESS) {
        successfulCount++;
        hasFinishedItems = true;
      } else if (item.status === STATUS_ERROR) {
        hasFinishedItems = true;
      } else if (item.status === STATUS_PROCESSING) {
        processingCount++;
      }

      const results = item.results;
      for (const format in results) {
        const res = results[format];
        if (res && res.status === STATUS_SUCCESS && res.size) {
          totalOptimized += res.size;
        }
      }
    }

    const savingsPercent =
      totalOriginal > 0
        ? totalOptimized === 0
          ? '0'
          : ((totalOriginal - totalOptimized) / totalOriginal * 100).toFixed(1)
        : '0';

    const allDone =
      items.length > 0 &&
      items.length === successfulCount + (items.length - successfulCount - processingCount);

    return {
      savingsPercent,
      allDone,
      successfulCount,
      hasFinishedItems,
      processingCount,
      doneCount: successfulCount,
    };
  }, [items]);
}
