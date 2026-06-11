import { observable } from '@legendapp/state'

import type { ImageItem } from '@/lib/queue/types'

import {
  LARGE_FILE_SERIAL_THRESHOLD_BYTES,
  LARGE_IMAGE_SERIAL_THRESHOLD_PIXELS,
  STATUS_PENDING,
} from '@/constants'
export interface PendingTask { isLarge: boolean; itemId: string; resultId: string }

/** Incremental pending work queue — avoids O(items × slots) computed rescans. */
export const pendingTasks$ = observable<PendingTask[]>([])

export function clearAllPendingTasks(): void {
  pendingTasks$.set([])
}

export function clearPendingTasksForItem(itemId: string): void {
  const next = pendingTasks$.peek().filter((p) => p.itemId !== itemId)
  pendingTasks$.set(next)
}

export function rebuildAllPendingTasks(
  items: Record<string, ImageItem | undefined>,
  order: string[],
): void {
  const pending: PendingTask[] = []
  for (const id of order) {
    const item = items[id]
    if (!item) continue
    const isLarge = isLargeItem(item)
    for (const rid in item.results) {
      const result = item.results[rid]
      if (result?.status === STATUS_PENDING) {
        pending.push({ isLarge, itemId: id, resultId: rid })
      }
    }
  }
  pendingTasks$.set(pending)
}

export function removePendingTask(itemId: string, resultId: string): void {
  const next = pendingTasks$.peek().filter((p) => !(p.itemId === itemId && p.resultId === resultId))
  if (next.length !== pendingTasks$.peek().length) {
    pendingTasks$.set(next)
  }
}

export function syncPendingTasksForItem(itemId: string, item: ImageItem): void {
  const isLarge = isLargeItem(item)
  const withoutItem = pendingTasks$.peek().filter((p) => p.itemId !== itemId)
  const added: PendingTask[] = []
  for (const rid in item.results) {
    const result = item.results[rid]
    if (result?.status === STATUS_PENDING) {
      added.push({ isLarge, itemId, resultId: rid })
    }
  }
  pendingTasks$.set([...withoutItem, ...added])
}

function isLargeItem(item: ImageItem): boolean {
  return (
    item.originalSize >= LARGE_FILE_SERIAL_THRESHOLD_BYTES ||
    (!!item.width &&
      !!item.height &&
      item.width * item.height >= LARGE_IMAGE_SERIAL_THRESHOLD_PIXELS)
  )
}
