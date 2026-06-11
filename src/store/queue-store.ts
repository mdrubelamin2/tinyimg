import { computed, observable } from '@legendapp/state'

import type { ImageItem } from '@/lib/queue/types'

import { isLargeItem } from '@/store/pending-tasks'
import { computeConcurrency } from '@/workers/worker-pool-v2'

export { pendingTasks$ } from '@/store/pending-tasks'

/**
 * Pure reactive state for the image queue.
 * Contains only data, no business logic or side effects.
 */
export const imageStore$ = observable({
  itemOrder: [] as string[],
  /** Per-id queue rows; absent key means removed */
  items: {} as Record<string, ImageItem | undefined>,
  /** Visible row ids from virtualization (order not significant) */
  visibleItemIds: [] as string[],
})

export const poolStats$ = observable({
  activeCount: 0,
  limit: computeConcurrency(),
})

/** Track active tasks at the result level (itemId:resultId -> boolean) */
export const inFlightTasks$ = observable({} as Record<string, boolean | undefined>)

/** Incremental counter for large-file tasks in flight (avoids scanning inFlightTasks$). */
export const largeFileInFlightCount$ = observable(0)

/** Large-drop intake progress. */
export const intake$ = observable({
  active: false,
  label: '',
  phase: 'idle' as 'collecting' | 'idle' | 'merging',
  processed: 0,
  total: 0,
})

export const isLargeFileInFlight$ = computed(() => largeFileInFlightCount$.get() > 0)

export function clearInFlightTracking(): void {
  inFlightTasks$.set({})
  largeFileInFlightCount$.set(0)
}

export function startInFlightTask(taskId: string, item: ImageItem): void {
  inFlightTasks$[taskId]!.set(true)
  if (isLargeItem(item)) {
    largeFileInFlightCount$.set(largeFileInFlightCount$.peek() + 1)
  }
}

export function stopInFlightTask(taskId: string, item: ImageItem | undefined): void {
  if (!inFlightTasks$[taskId]?.peek()) return
  inFlightTasks$[taskId]!.delete()
  if (item && isLargeItem(item)) {
    largeFileInFlightCount$.set(Math.max(0, largeFileInFlightCount$.peek() - 1))
  }
}
