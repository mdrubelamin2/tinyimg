import { batch } from '@legendapp/state'
import * as Comlink from 'comlink'

import type { ImageItem } from '@/lib/queue/types'
import type { ThumbnailAPI } from '@/workers/thumbnail.worker'

import { resolveOriginalSourceFile } from '@/storage/queue-binary'
import { imageStore$ } from '@/store/image-store'
import {
  setThumbnailEvictionHandler,
  setThumbnailVisibleIdsGetter,
  thumbnailCachePeek,
  thumbnailCacheRevoke,
  thumbnailCacheSet,
} from '@/thumbnails/thumbnail-cache'
import ThumbnailWorkerUrl from '@/workers/thumbnail.worker.ts?worker&url'

interface QueueEntry {
  file: File
  id: string
}

let worker: null | Worker = null
let proxy: Comlink.Remote<ThumbnailAPI> | null = null
const queue: QueueEntry[] = []
const queuedId = new Set<string>()
let busy = false

export function cancelThumbnail(id: string): void {
  thumbnailCacheRevoke(id)
  queuedId.delete(id)
  const idx = queue.findIndex((q) => q.id === id)
  if (idx !== -1) queue.splice(idx, 1)
}

export function destroyThumbnailWorker(): void {
  if (worker) {
    worker.terminate()
    worker = null
  }
  queue.length = 0
  queuedId.clear()
  busy = false
}

export function enqueueThumbnail(id: string, file: File): void {
  if (queuedId.has(id)) return
  queuedId.add(id)
  queue.push({ file, id })
  pump()
}

export function enqueueThumbnails(ids: readonly string[]): void {
  void (async () => {
    for (const id of ids) {
      if (!imageStore$.items[id]?.peek()) continue
      let file: File | null = null
      try {
        file = await resolveOriginalSourceFile(id, imageStore$.items[id]!.peek()!)
      } catch {
        continue
      }
      if (!imageStore$.items[id]?.peek()) continue // post-async stale-check
      if (file && file.size > 0) enqueueThumbnail(id, file)
    }
  })()
}

/** Prioritize visible ids (Virtuoso range); others keep FIFO order. */
export function prioritizeThumbnails(visibleIds: readonly string[]): void {
  if (visibleIds.length === 0) return
  const want = new Set(visibleIds)
  const hi: QueueEntry[] = []
  const lo: QueueEntry[] = []
  for (const e of queue) {
    if (want.has(e.id)) hi.push(e)
    else lo.push(e)
  }
  queue.length = 0
  queue.push(...hi, ...lo)
}

async function ensureWorker(): Promise<Comlink.Remote<ThumbnailAPI>> {
  if (proxy) return proxy
  const url = new URL(ThumbnailWorkerUrl, import.meta.url)
  worker = new Worker(url, { type: 'module' })
  const channel = new MessageChannel()
  worker.postMessage({ port: channel.port2, type: 'INIT' }, [channel.port2])
  proxy = Comlink.wrap<ThumbnailAPI>(channel.port1)
  return proxy
}

async function pump(): Promise<void> {
  if (busy) return
  const next = queue.shift()
  if (!next) return
  busy = true
  queuedId.delete(next.id)

  try {
    const api = await ensureWorker()
    const buffer = await next.file.arrayBuffer()
    const data = await api.generate(next.id, Comlink.transfer(buffer, [buffer]), next.file.type)

    if (data.type === 'THUMB_OK') {
      const urlStr = URL.createObjectURL(data.blob)
      thumbnailCacheSet(data.id, urlStr)

      const stillCached = thumbnailCachePeek(data.id) === urlStr
      if (stillCached) {
        const item = imageStore$.items[data.id]?.peek() as ImageItem | undefined
        if (item) {
          const prev = item.previewUrl
          batch(() => {
            const nextItem = { ...item, previewUrl: urlStr }
            if (data.width && data.height && (!item.width || !item.height)) {
              nextItem.width = data.width
              nextItem.height = data.height
            }
            imageStore$.items[data.id]?.set(nextItem)
          })
          if (prev) URL.revokeObjectURL(prev)
        }
      } else {
        URL.revokeObjectURL(urlStr)
      }
    } else if (data.type === 'THUMB_ERR') {
      console.warn('thumbnail worker', data.id, data.error)
    }
  } catch (error) {
    console.error('Thumbnail generation failed', error)
  } finally {
    busy = false
    void pump()
  }
}

setThumbnailVisibleIdsGetter(() => new Set(imageStore$.visibleItemIds.peek()))

/** LRU eviction revokes blob URLs; clear stale Legend `previewUrl` and regenerate for that row. */
setThumbnailEvictionHandler((id) => {
  batch(() => {
    const item = imageStore$.items[id]?.peek() as ImageItem | undefined
    if (!item) return
    imageStore$.items[id]?.set({ ...item, previewUrl: undefined })
  })
  void enqueueThumbnails([id])
})
