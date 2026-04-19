import { batch } from '@legendapp/state';
import { imageStore$ } from '@/store/image-store';
import type { ImageItem } from '@/lib/queue/types';
import { resolveOriginalSourceFile } from '@/storage/queue-binary';
import ThumbnailWorkerUrl from '@/workers/thumbnail.worker.ts?worker&url';
import {
  thumbnailCacheRevoke,
  thumbnailCacheSet,
  thumbnailCachePeek,
  setThumbnailEvictionHandler,
  setThumbnailVisibleIdsGetter,
} from '@/thumbnails/thumbnail-cache';
import type { ThumbnailWorkerInbound, ThumbnailWorkerOutbound } from '@/thumbnails/thumbnail-protocol';

type QueueEntry = { id: string; file: File };

let worker: Worker | null = null;
const queue: QueueEntry[] = [];
const queuedId = new Set<string>();
let busy = false;

function ensureWorker(): Worker {
  if (worker) return worker;
  const url = new URL(ThumbnailWorkerUrl, import.meta.url);
  worker = new Worker(url, { type: 'module' });
  worker.onmessage = (ev: MessageEvent<ThumbnailWorkerOutbound>) => {
    const data = ev.data;
    if (data.type === 'THUMB_OK') {
      const urlStr = URL.createObjectURL(data.blob);
      thumbnailCacheSet(data.id, urlStr);

      const stillCached = thumbnailCachePeek(data.id) === urlStr;
      if (stillCached) {
        const item = imageStore$.items[data.id]?.peek() as ImageItem | undefined;
        if (item) {
          const prev = item.previewUrl;
          batch(() => {
            imageStore$.items[data.id]?.set({ ...item, previewUrl: urlStr });
          });
          if (prev) URL.revokeObjectURL(prev);
        }
      } else {
        URL.revokeObjectURL(urlStr);
      }
    }
    if (data.type === 'THUMB_ERR') {
      console.warn('thumbnail worker', data.id, data.error);
    }
    busy = false;
    pump();
  };
  worker.onerror = () => {
    busy = false;
    pump();
  };
  return worker;
}

function pump(): void {
  if (busy) return;
  const next = queue.shift();
  if (!next) return;
  busy = true;
  queuedId.delete(next.id);
  const w = ensureWorker();
  w.postMessage({ type: 'THUMB', id: next.id, file: next.file } satisfies ThumbnailWorkerInbound);
}

/** Prioritize visible ids (Virtuoso range); others keep FIFO order. */
export function prioritizeThumbnails(visibleIds: readonly string[]): void {
  if (visibleIds.length === 0) return;
  const want = new Set(visibleIds);
  const hi: QueueEntry[] = [];
  const lo: QueueEntry[] = [];
  for (const e of queue) {
    if (want.has(e.id)) hi.push(e);
    else lo.push(e);
  }
  queue.length = 0;
  queue.push(...hi, ...lo);
}

export function enqueueThumbnail(id: string, file: File): void {
  if (queuedId.has(id)) return;
  queuedId.add(id);
  queue.push({ id, file });
  pump();
}

export function enqueueThumbnails(ids: readonly string[]): void {
  void (async () => {
    for (const id of ids) {
      if (!imageStore$.items[id]?.peek()) continue;
      let file: File | null = null;
      try {
        file = await resolveOriginalSourceFile(id, imageStore$.items[id]!.peek()!);
      } catch {
        continue;
      }
      if (!imageStore$.items[id]?.peek()) continue; // post-async stale-check
      if (file) enqueueThumbnail(id, file);
    }
  })();
}

export function cancelThumbnail(id: string): void {
  thumbnailCacheRevoke(id);
  queuedId.delete(id);
  const idx = queue.findIndex((q) => q.id === id);
  if (idx >= 0) queue.splice(idx, 1);
}

export function destroyThumbnailWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  queue.length = 0;
  queuedId.clear();
  busy = false;
}

setThumbnailVisibleIdsGetter(() => new Set(imageStore$.visibleItemIds.peek()));

/** LRU eviction revokes blob URLs; clear stale Legend `previewUrl` and regenerate for that row. */
setThumbnailEvictionHandler((id) => {
  batch(() => {
    const item = imageStore$.items[id]?.peek() as ImageItem | undefined;
    if (!item) return;
    imageStore$.items[id]?.set({ ...item, previewUrl: undefined });
  });
  void enqueueThumbnails([id]);
});
