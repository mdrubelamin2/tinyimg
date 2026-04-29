/**
 * Unified Image Store: Delegating logic to services while maintaining a legacy-compatible API.
 */

import { batch } from '@legendapp/state'
import { useValue } from '@legendapp/state/react'

import type { GlobalOptions } from '@/constants'
import type { ImageItem } from '@/lib/queue/types'

import {
  OUTPUT_QUALITY_MAX,
  OUTPUT_QUALITY_MIN,
  STATUS_PENDING,
  STATUS_PROCESSING,
} from '@/constants'
import { buildAndDownloadZip, revokeResultUrls } from '@/lib/download'
import { buildOutputSlots } from '@/lib/queue/output-slots'
import { resetItemResultsForOptions } from '@/lib/queue/queue-item'
import { addFiles as addFilesService } from '@/services/intake-service'
import { resetPersistChain } from '@/services/storage-sync'
import {
  applyWorkerError,
  applyWorkerResult,
  batchApplyResults,
  destroyPool,
  getPool,
  processNextAsync,
} from '@/services/worker-coordinator'
import {
  clearDirectDropOriginals,
  releaseDirectDropOriginal,
} from '@/storage/dropped-original-files'
import { deleteItemPayloads } from '@/storage/queue-binary'
import { thumbnailCacheClear } from '@/thumbnails/thumbnail-cache'
import { cancelThumbnail, destroyThumbnailWorker } from '@/thumbnails/thumbnail-generator'

import { imageStore$, inFlightTasks$, intake$ } from './queue-store'

function isTerminal(item: ImageItem): boolean {
  return !Object.values(item.results).some(
    (r) => r.status === 'processing' || r.status === 'pending',
  )
}

let cachedItemsRef: null | Record<string, ImageItem | undefined> = null
let cachedOrderRef: null | string[] = null
let cachedOrderedItems: ImageItem[] = []

function itemsToArray(items: Record<string, ImageItem | undefined>, order: string[]): ImageItem[] {
  if (items === cachedItemsRef && order === cachedOrderRef) {
    return cachedOrderedItems
  }
  cachedItemsRef = items
  cachedOrderRef = order
  cachedOrderedItems = order.map((id) => items[id]).filter((i): i is ImageItem => i != null)
  return cachedOrderedItems
}

let memoKey: null | {
  itemsRef: Record<string, ImageItem | undefined>
  orderRef: string[]
} = null
let memoMap: Map<string, ImageItem> | null = null

export const imageStoreSingleton = {
  _applyWorkerError: applyWorkerError,
  _applyWorkerResult: applyWorkerResult,
  _batchApplyResults: batchApplyResults,
  _getPool: getPool,

  _processNext: (options: GlobalOptions) => {
    void processNextAsync(options)
  },

  _processNextAsync: processNextAsync,

  addFiles: addFilesService,

  applyGlobalOptions(options: GlobalOptions) {
    batch(() => {
      const itemTasksToCancel: { itemId: string; resultId: string }[] = []
      const items = imageStore$.items.peek()
      const p = getPool()

      for (const id of imageStore$.itemOrder.peek()) {
        const item = items[id]
        if (!item) continue

        p.removeTasksForItem(id) // Clear queued tasks with old options
        const result = resetItemResultsForOptions(item, options)
        itemTasksToCancel.push(
          ...result.resultIdsToCancel.map((rid) => ({
            itemId: id,
            resultId: rid,
          })),
        )
        imageStore$.items[id]!.set(result.nextItem)
      }

      if (itemTasksToCancel.length > 0) {
        for (const { itemId, resultId } of itemTasksToCancel) {
          p.cancelTask(`${itemId}:${resultId}`)
          inFlightTasks$[`${itemId}:${resultId}`]?.delete()
        }
      }
    })
  },

  async clearAll() {
    inFlightTasks$.set({})
    resetPersistChain()
    destroyThumbnailWorker()
    thumbnailCacheClear()

    const items = imageStore$.items.peek()
    for (const id of imageStore$.itemOrder.peek()) {
      const item = items[id]
      if (!item) continue
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      revokeResultUrls(item)
      void deleteItemPayloads(id)
    }
    clearDirectDropOriginals()
    await destroyPool()

    batch(() => {
      imageStore$.items.set({})
      imageStore$.itemOrder.set([])
      imageStore$.visibleItemIds.set([])
      intake$.set({
        active: false,
        label: '',
        phase: 'idle',
        processed: 0,
        total: 0,
      })
    })
  },

  clearFinished() {
    batch(() => {
      const prevOrder = [...imageStore$.itemOrder.peek()]
      const nextOrder: string[] = []
      const items = imageStore$.items.peek()

      for (const id of prevOrder) {
        const item = items[id]
        if (!item) continue
        if (item.status === STATUS_PROCESSING || item.status === STATUS_PENDING) {
          nextOrder.push(id)
          continue
        }
        cancelThumbnail(id)
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
        revokeResultUrls(item)
        releaseDirectDropOriginal(id)
        void deleteItemPayloads(id)
        imageStore$.items[id]?.delete()
      }
      imageStore$.itemOrder.set(nextOrder)
    })
  },

  async downloadAll() {
    const items = imageStore$.items.peek()
    const order = imageStore$.itemOrder.peek()
    const arr = order.map((id) => items[id]).filter((i): i is ImageItem => i != null)
    await buildAndDownloadZip(arr)
  },

  get itemOrder() {
    return [...imageStore$.itemOrder.peek()]
  },

  get items() {
    const items = imageStore$.items.get()
    const order = imageStore$.itemOrder.get()
    if (memoKey && memoKey.orderRef === order && memoKey.itemsRef === items) {
      return memoMap!
    }
    const map = new Map<string, ImageItem>()
    for (const id of order) {
      const it = items[id]
      if (it) map.set(id, it)
    }
    memoKey = { itemsRef: items, orderRef: order }
    memoMap = map
    return map
  },

  get pendingIds() {
    const items = imageStore$.items.get()
    const order = imageStore$.itemOrder.get()
    const pending = new Set<string>()
    for (const id of order) {
      const item = items[id]
      if (
        item &&
        (!isTerminal(item) || Object.values(item.results).some((r) => r.status === STATUS_PENDING))
      ) {
        pending.add(id)
      }
    }
    return pending
  },

  removeItem(id: string) {
    const item = imageStore$.items[id]?.peek()
    if (!item) return

    getPool().abortInFlightForItem(id)
    cancelThumbnail(id)
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    revokeResultUrls(item)
    releaseDirectDropOriginal(id)
    void deleteItemPayloads(id)

    batch(() => {
      imageStore$.items[id]?.delete()
      imageStore$.itemOrder.set(imageStore$.itemOrder.peek().filter((i) => i !== id))
      for (const rid in item.results) {
        inFlightTasks$[`${id}:${rid}`]?.delete()
      }
    })
  },
  reorderItems(fromIndex: number, toIndex: number) {
    const order = [...imageStore$.itemOrder.peek()]
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= order.length ||
      toIndex >= order.length ||
      fromIndex === toIndex
    ) {
      return
    }
    const nextOrder = [...order]
    const [removed] = nextOrder.splice(fromIndex, 1)
    nextOrder.splice(toIndex, 0, removed!)
    imageStore$.itemOrder.set(nextOrder)
  },
  setItemOutputFormats(id: string, formats: null | string[], options: GlobalOptions) {
    getPool().abortInFlightForItem(id)
    const item = imageStore$.items[id]?.peek()
    if (!item) return

    revokeResultUrls(item)
    const nextItem: ImageItem = {
      ...item,
      error: undefined,
      outputFormatsOverride: formats != null && formats.length > 0 ? formats : null,
      progress: 0,
      status: STATUS_PENDING,
    }

    const slots = buildOutputSlots(nextItem, options)
    nextItem.results = Object.fromEntries(
      slots.map((slot) => [
        slot.resultId,
        {
          format: slot.format,
          resultId: slot.resultId,
          status: STATUS_PENDING,
          variantLabel: slot.variantLabel,
        },
      ]),
    )

    batch(() => {
      imageStore$.items[id]!.set(nextItem)
      for (const rid in item.results) {
        inFlightTasks$[`${id}:${rid}`]?.delete()
      }
    })
  },
  setItemQualityPercent(id: string, percent: null | number, options: GlobalOptions) {
    const clamped =
      percent == null
        ? null
        : Math.min(OUTPUT_QUALITY_MAX, Math.max(OUTPUT_QUALITY_MIN, Math.round(percent)))

    getPool().abortInFlightForItem(id)
    const item = imageStore$.items[id]?.peek()
    if (!item) return

    revokeResultUrls(item)
    const nextItem: ImageItem = {
      ...item,
      error: undefined,
      progress: 0,
      qualityPercentOverride: clamped,
      status: STATUS_PENDING,
    }

    const slots = buildOutputSlots(nextItem, options)
    nextItem.results = Object.fromEntries(
      slots.map((slot) => [
        slot.resultId,
        {
          format: slot.format,
          resultId: slot.resultId,
          status: STATUS_PENDING,
          variantLabel: slot.variantLabel,
        },
      ]),
    )

    batch(() => {
      imageStore$.items[id]!.set(nextItem)
      for (const rid in item.results) {
        inFlightTasks$[`${id}:${rid}`]?.delete()
      }
    })
  },
  setVisibleItems(ids: string[]) {
    imageStore$.visibleItemIds.set([...ids])
  },
  get visibleItemIds() {
    return new Set(imageStore$.visibleItemIds.peek() as string[])
  },
}

export const getImageStore = () => imageStoreSingleton

export const useImageStore = Object.assign(
  <T>(selector: (state: typeof imageStoreSingleton) => T): T => {
    return useValue(() => selector(imageStoreSingleton))
  },
  {
    getState: () => imageStoreSingleton,
    setState: (partial: Record<string, unknown>) => {
      batch(() => {
        if (partial['items']) {
          const nextItems: Record<string, ImageItem | undefined> = {}
          if (partial['items'] instanceof Map) {
            for (const [id, item] of partial['items']) {
              nextItems[id] = item as ImageItem
            }
          } else {
            Object.assign(nextItems, partial['items'])
          }
          imageStore$.items.set(nextItems)
        }
        if (partial['itemOrder']) {
          imageStore$.itemOrder.set([...(partial['itemOrder'] as string[])])
        }
      })
    },
  },
)

export const selectOrderedItems = (state: typeof imageStoreSingleton): ImageItem[] => {
  const itemsObj: Record<string, ImageItem | undefined> = {}
  if (state.items instanceof Map) {
    for (const [id, item] of state.items) {
      itemsObj[id] = item
    }
  } else {
    Object.assign(itemsObj, state.items)
  }
  return itemsToArray(itemsObj, state.itemOrder)
}

export const selectItemCount = (): number => {
  return imageStore$.itemOrder.get().length
}

export { imageStore$, inFlightTasks$, intake$ } from './queue-store'
