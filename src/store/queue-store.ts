import { computed, observable } from '@legendapp/state'

import type { ImageItem } from '@/lib/queue/types'

import { LARGE_FILE_SERIAL_THRESHOLD_BYTES, LARGE_IMAGE_SERIAL_THRESHOLD_PIXELS } from '@/constants'
import { computeConcurrency } from '@/workers/worker-pool-v2'

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

/** Derived work queue: flattened list of (itemId, resultId) for results with STATUS_PENDING */
export const pendingTasks$ = computed(() => {
  const items = imageStore$.items.get()
  const order = imageStore$.itemOrder.get()
  const visible = new Set(imageStore$.visibleItemIds.get())

  const pending: { isLarge: boolean; itemId: string; resultId: string }[] = []

  for (const id of order) {
    const item = items[id]
    if (!item) continue

    const isLarge =
      item.originalSize >= LARGE_FILE_SERIAL_THRESHOLD_BYTES ||
      (!!item.width &&
        !!item.height &&
        item.width * item.height >= LARGE_IMAGE_SERIAL_THRESHOLD_PIXELS)
    for (const rid in item.results) {
      if (item.results[rid]?.status === 'pending') {
        // console.log(`Item ${id} isLarge: ${isLarge}`);
        pending.push({ isLarge, itemId: id, resultId: rid })
      }
    }
  }

  // Sort by visibility first
  return pending.sort((a, b) => {
    const aVisible = visible.has(a.itemId)
    const bVisible = visible.has(b.itemId)
    if (aVisible && !bVisible) return -1
    if (!aVisible && bVisible) return 1
    return 0
  })
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
