/**
 * Derive queue stats from items: savings percent, all-done, has-finished, successful count.
 */

import type { ImageItem } from '@/lib/queue/types';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/constants/index';

export interface QueueStats {
  savingsPercent: string;
  allDone: boolean;
  successfulCount: number;
  hasFinishedItems: boolean;
}

export function useQueueStats(items: ImageItem[]): QueueStats {
  let totalOriginal = 0;
  let totalOptimized = 0;

  items.forEach(item => {
    totalOriginal += item.originalSize;
    Object.values(item.results).forEach(res => {
      if (res.status === STATUS_SUCCESS && res.size) {
        totalOptimized += res.size;
      }
    });
  });

  const savingsPercent =
    totalOriginal > 0
      ? totalOptimized === 0
        ? '0'
        : ((totalOriginal - totalOptimized) / totalOriginal * 100).toFixed(1)
      : '0';
  const allDone =
    items.length > 0 &&
    items.every(i => i.status === STATUS_SUCCESS || i.status === STATUS_ERROR);
  const successfulCount = items.filter(i => i.status === STATUS_SUCCESS).length;
  const hasFinishedItems = items.some(
    i => i.status === STATUS_SUCCESS || i.status === STATUS_ERROR
  );

  return { savingsPercent, allDone, successfulCount, hasFinishedItems };
}
