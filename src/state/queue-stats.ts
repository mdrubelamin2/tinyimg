import { batch, observe, observable } from '@legendapp/state';
import { imageStore$ } from '@/store/image-store';
import {
  STATUS_SUCCESS,
  STATUS_ERROR,
  STATUS_PROCESSING,
  STATUS_PENDING,
  CONFETTI_PARTICLE_COUNT,
  CONFETTI_SPREAD,
  CONFETTI_ORIGIN_Y,
  CONFETTI_COLORS,
} from '@/constants';
import type { ImageItem } from '@/lib/queue/types';

/** Heuristic typical savings % by MIME for pre-result estimate (instant feedback). */
const SAVINGS_TYPICAL_BY_MIME: Record<string, number> = {
  'image/jpeg': 35,
  'image/png': 55,
  'image/webp': 25,
  'image/avif': 15,
  'image/svg+xml': 35,
  'image/gif': 40,
  'image/bmp': 50,
  'image/tiff': 30,
};

function mimeForItem(item: ImageItem): string {
  if (item.mimeType) return item.mimeType;
  const ext = item.originalFormat.toLowerCase();
  if (ext === 'jpg') return 'image/jpeg';
  return `image/${ext}`;
}

export interface QueueStats {
  savingsPercent: string;
  allDone: boolean;
  successfulCount: number;
  hasFinishedItems: boolean;
  processingCount: number;
  doneCount: number;
  itemCount: number;
  /** Typical savings % × bytes for pending/processing rows (UI hint only). */
  estimatedOptimizedBytes: number;
  estimatedSavingsLabel: string;
  /** Every row finished with success (e.g. confetti, no errors). */
  allSuccessful: boolean;
}

function computeQueueStats(): QueueStats {
  const order = imageStore$.itemOrder.peek();
  const itemCount = order.length;
  let totalOriginal = 0;
  let totalOptimized = 0;
  let estimatedOptimizedBytes = 0;

  let successfulCount = 0;
  let hasFinishedItems = false;
  let processingCount = 0;

  for (const id of order) {
    const item = imageStore$.items[id]?.peek() as ImageItem | undefined;
    if (!item) continue;

    totalOriginal += item.originalSize;

    if (item.status === STATUS_SUCCESS) successfulCount++;
    if (item.status === STATUS_SUCCESS || item.status === STATUS_ERROR) {
      hasFinishedItems = true;
    }
    if (item.status === STATUS_PROCESSING) processingCount++;

    if (item.status === STATUS_PENDING || item.status === STATUS_PROCESSING) {
      const mime = mimeForItem(item);
      const pct = SAVINGS_TYPICAL_BY_MIME[mime] ?? 28;
      estimatedOptimizedBytes += item.originalSize * (1 - pct / 100);
    }

    for (const res of Object.values(item.results)) {
      if (res.status === STATUS_SUCCESS && res.size) {
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
    itemCount > 0 &&
    order.every((id) => {
      const item = imageStore$.items[id]?.peek() as ImageItem | undefined;
      return item?.status === STATUS_SUCCESS || item?.status === STATUS_ERROR;
    });

  const allSuccessful =
    itemCount > 0 &&
    order.every((id) => {
      const item = imageStore$.items[id]?.peek() as ImageItem | undefined;
      return item?.status === STATUS_SUCCESS;
    });

  const estLabel =
    itemCount > 0 && totalOriginal > 0
      ? `~${((1 - estimatedOptimizedBytes / totalOriginal) * 100).toFixed(0)}% est. while processing`
      : '';

  return {
    savingsPercent,
    allDone,
    successfulCount,
    hasFinishedItems,
    processingCount,
    doneCount: successfulCount,
    itemCount,
    estimatedOptimizedBytes,
    estimatedSavingsLabel: estLabel,
    allSuccessful,
  };
}

function statsEqual(a: QueueStats, b: QueueStats): boolean {
  return (
    a.savingsPercent === b.savingsPercent &&
    a.allDone === b.allDone &&
    a.successfulCount === b.successfulCount &&
    a.hasFinishedItems === b.hasFinishedItems &&
    a.processingCount === b.processingCount &&
    a.doneCount === b.doneCount &&
    a.itemCount === b.itemCount &&
    a.estimatedOptimizedBytes === b.estimatedOptimizedBytes &&
    a.estimatedSavingsLabel === b.estimatedSavingsLabel &&
    a.allSuccessful === b.allSuccessful
  );
}

/**
 * Aggregated queue metrics for the UI. Updates are debounced to at most once per animation frame
 * when the store churns (e.g. many worker completions per frame), capping main-thread work.
 */
export const queueStats$ = observable<QueueStats>(computeQueueStats());

let rafId = 0;
let confettiFiredForAllSuccessful = false;

function maybeFireAllSuccessfulConfetti(prev: QueueStats, next: QueueStats): void {
  if (!next.allSuccessful) {
    confettiFiredForAllSuccessful = false;
    return;
  }
  if (prev.allSuccessful || confettiFiredForAllSuccessful) return;
  confettiFiredForAllSuccessful = true;
  void import('canvas-confetti').then(({ default: confetti }) => {
    confetti({
      particleCount: CONFETTI_PARTICLE_COUNT,
      spread: CONFETTI_SPREAD,
      origin: { y: CONFETTI_ORIGIN_Y },
      colors: [...CONFETTI_COLORS],
      disableForReducedMotion: true,
    });
  });
}

function scheduleStatsFlush(): void {
  if (rafId !== 0) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    const next = computeQueueStats();
    const prev = queueStats$.peek();
    if (statsEqual(prev, next)) return;
    maybeFireAllSuccessfulConfetti(prev, next);
    batch(() => {
      queueStats$.set(next);
    });
  });
}

observe(() => {
  imageStore$.itemOrder.get();
  for (const id of imageStore$.itemOrder.peek()) {
    imageStore$.items[id]?.status.get();
    imageStore$.items[id]?.results.get();
  }
  scheduleStatsFlush();
});
