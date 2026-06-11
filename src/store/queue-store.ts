import { computed, observable } from '@legendapp/state'

import type { ImageItem } from '@/lib/queue/types'

import { LARGE_FILE_SERIAL_THRESHOLD_BYTES, LARGE_IMAGE_SERIAL_THRESHOLD_PIXELS } from '@/constants'
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

/** Large-drop intake progress. */
export const intake$ = observable({
  active: false,
  label: '',
  phase: 'idle' as 'collecting' | 'idle' | 'merging',
  processed: 0,
  total: 0,
})

export const isLargeFileInFlight$ = computed(() => {
  const inFlight = inFlightTasks$.get()
  const items = imageStore$.items

  return Object.keys(inFlight).some((taskId) => {
    if (!inFlight[taskId]) return false
    const [itemId] = taskId.split(':') as [string]
    const item = items[itemId]?.peek()
    return (
      item &&
      (item.originalSize >= LARGE_FILE_SERIAL_THRESHOLD_BYTES ||
        (item.width &&
          item.height &&
          item.width * item.height >= LARGE_IMAGE_SERIAL_THRESHOLD_PIXELS))
    )
  })
})
