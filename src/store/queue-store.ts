import { observable, computed } from '@legendapp/state';
import type { ImageItem } from '@/lib/queue/types';
import { computeConcurrency } from '@/workers/worker-pool-v2';
import { LARGE_FILE_SERIAL_THRESHOLD_BYTES, LARGE_IMAGE_SERIAL_THRESHOLD_PIXELS } from '@/constants';

/**
 * Pure reactive state for the image queue.
 * Contains only data, no business logic or side effects.
 */
export const imageStore$ = observable({
  /** Per-id queue rows; absent key means removed */
  items: {} as Record<string, ImageItem | undefined>,
  itemOrder: [] as string[],
  /** Visible row ids from virtualization (order not significant) */
  visibleItemIds: [] as string[],
});

export const poolStats$ = observable({
  activeCount: 0,
  limit: computeConcurrency(),
});

/** Track active tasks at the result level (itemId:resultId -> boolean) */
export const inFlightTasks$ = observable({} as Record<string, boolean | undefined>);

/** Large-drop intake progress. */
export const intake$ = observable({
  active: false,
  phase: 'idle' as 'idle' | 'collecting' | 'merging',
  label: '',
  processed: 0,
  total: 0,
});

/** Derived work queue: flattened list of (itemId, resultId) for results with STATUS_PENDING */
export const pendingTasks$ = computed(() => {
  const items = imageStore$.items.get();
  const order = imageStore$.itemOrder.get();
  const visible = new Set(imageStore$.visibleItemIds.get());

  const pending: { itemId: string; resultId: string; isLarge: boolean }[] = [];

  for (const id of order) {
    const item = items[id];
    if (!item) continue;

    const isLarge =
      item.originalSize >= LARGE_FILE_SERIAL_THRESHOLD_BYTES ||
      (!!item.width &&
        !!item.height &&
        item.width * item.height >= LARGE_IMAGE_SERIAL_THRESHOLD_PIXELS);
    for (const rid in item.results) {
      if (item.results[rid]?.status === 'pending') {
        // console.log(`Item ${id} isLarge: ${isLarge}`);
        pending.push({ itemId: id, resultId: rid, isLarge });
      }
    }
  }

  // Sort by visibility first
  return pending.sort((a, b) => {
    const aVisible = visible.has(a.itemId);
    const bVisible = visible.has(b.itemId);
    if (aVisible && !bVisible) return -1;
    if (!aVisible && bVisible) return 1;
    return 0;
  });
});

export const isLargeFileInFlight$ = computed(() => {
  const inFlight = inFlightTasks$.get();
  const items = imageStore$.items.peek();

  return Object.keys(inFlight).some(taskId => {
    if (!inFlight[taskId]) return false;
    const [itemId] = taskId.split(':') as [string];
    const item = items[itemId];
    return (
      item &&
      (item.originalSize >= LARGE_FILE_SERIAL_THRESHOLD_BYTES ||
        (item.width &&
          item.height &&
          item.width * item.height >= LARGE_IMAGE_SERIAL_THRESHOLD_PIXELS))
    );
  });
});
