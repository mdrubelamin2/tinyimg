import { observable } from '@legendapp/state'

import type { ImageItem } from '@/lib/queue/types'

import {
  LARGE_FILE_SERIAL_THRESHOLD_BYTES,
  LARGE_IMAGE_SERIAL_THRESHOLD_PIXELS,
  STATUS_PENDING,
} from '@/constants'

export interface PendingTask {
  isLarge: boolean
  itemId: string
  resultId: string
}

type PendingMap = Map<string, Map<string, PendingTask>>

const pendingTasksMap$ = observable<PendingMap>(new Map())

/** Flat view for reactive scheduling; kept in sync with the nested map. */
export const pendingTasks$ = observable<PendingTask[]>([])

export function clearAllPendingTasks(): void {
  pendingTasksMap$.set(new Map())
  pendingTasks$.set([])
}

export function clearPendingTasksForItem(itemId: string): void {
  const map = new Map(pendingTasksMap$.peek())
  if (!map.delete(itemId)) return
  commitPendingMap(map)
}

export function isLargeItem(item: ImageItem): boolean {
  return (
    item.originalSize >= LARGE_FILE_SERIAL_THRESHOLD_BYTES ||
    (!!item.width &&
      !!item.height &&
      item.width * item.height >= LARGE_IMAGE_SERIAL_THRESHOLD_PIXELS)
  )
}

export function peekPendingTasks(): PendingTask[] {
  return flattenPendingMap(pendingTasksMap$.peek())
}

export function rebuildAllPendingTasks(
  items: Record<string, ImageItem | undefined>,
  order: string[],
): void {
  const map: PendingMap = new Map()
  for (const id of order) {
    const item = items[id]
    if (!item) continue
    const byResult = pendingForItem(id, item)
    if (byResult.size > 0) {
      map.set(id, byResult)
    }
  }
  commitPendingMap(map)
}

export function removePendingTask(itemId: string, resultId: string): void {
  const map = new Map(pendingTasksMap$.peek())
  const byResult = map.get(itemId)
  if (!byResult) return
  const nextByResult = new Map(byResult)
  if (!nextByResult.delete(resultId)) return
  if (nextByResult.size === 0) {
    map.delete(itemId)
  } else {
    map.set(itemId, nextByResult)
  }
  commitPendingMap(map)
}

export function syncPendingTasksForItem(itemId: string, item: ImageItem): void {
  const map = new Map(pendingTasksMap$.peek())
  const byResult = pendingForItem(itemId, item)
  if (byResult.size === 0) {
    map.delete(itemId)
  } else {
    map.set(itemId, byResult)
  }
  commitPendingMap(map)
}

function commitPendingMap(map: PendingMap): void {
  pendingTasksMap$.set(map)
  pendingTasks$.set(flattenPendingMap(map))
}

function flattenPendingMap(map: PendingMap): PendingTask[] {
  const result: PendingTask[] = []
  for (const byResult of map.values()) {
    for (const task of byResult.values()) {
      result.push(task)
    }
  }
  return result
}

function pendingForItem(itemId: string, item: ImageItem): Map<string, PendingTask> {
  const isLarge = isLargeItem(item)
  const byResult = new Map<string, PendingTask>()
  for (const rid in item.results) {
    const result = item.results[rid]
    if (result?.status === STATUS_PENDING) {
      byResult.set(rid, { isLarge, itemId, resultId: rid })
    }
  }
  return byResult
}
