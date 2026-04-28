import { batch, observe } from '@legendapp/state'

import type { GlobalOptions } from '@/constants'
import type { ImageItem, ImageResult, Task, WorkerOutbound } from '@/lib/queue/types'

import { ERR_WORKER, STATUS_ERROR, STATUS_PROCESSING, STATUS_SUCCESS } from '@/constants'
import { buildOutputSlots } from '@/lib/queue/output-slots'
import { resolveOriginalSourceFile } from '@/storage/queue-binary'
import {
  imageStore$,
  inFlightTasks$,
  intake$,
  isLargeFileInFlight$,
  pendingTasks$,
  poolStats$,
} from '@/store/queue-store'
import { useSettingsStore } from '@/store/settings-store'
import { computeConcurrency, WorkerPool } from '@/workers/worker-pool-v2'

import { schedulePersistWorkerResults } from './storage-sync'

let pool: null | WorkerPool = null
let responseBuffer: WorkerOutbound[] = []
let errorBuffer: (null | Task)[] = []
let flushScheduled = false
let isScheduling = false

export function applyWorkerError(task: null | Task): void {
  errorBuffer.push(task)
  if (!flushScheduled) {
    flushScheduled = true
    requestAnimationFrame(() => {
      batchApplyResults()
    })
  }
}

export function applyWorkerResult(response: WorkerOutbound): void {
  if (response.type === 'RESULT') {
    schedulePersistWorkerResults([response])
    return
  }

  responseBuffer.push(response)
  if (!flushScheduled) {
    flushScheduled = true
    requestAnimationFrame(() => {
      batchApplyResults()
    })
  }
}

export function batchApplyResults(): void {
  const responses = [...responseBuffer]
  const errors = [...errorBuffer]
  responseBuffer = []
  errorBuffer = []
  flushScheduled = false

  if (responses.length === 0 && errors.length === 0) return

  batch(() => {
    for (const response of responses) {
      if (response.type === 'ERROR') {
        const item = imageStore$.items[response.id]?.peek()
        if (!item) continue

        const rid = response.resultId
        const prev = item.results[rid]
        const nextItem = { ...item }
        const merged: ImageResult = {
          ...(prev ?? {
            format: response.format,
            resultId: rid,
            status: STATUS_PROCESSING,
            variantLabel: '',
          }),
          error: response.error,
          format: response.format,
          resultId: rid,
          status: STATUS_ERROR,
        }
        nextItem.results = {
          ...item.results,
          [rid]: merged,
        }

        if (isTerminal(nextItem)) {
          nextItem.status = STATUS_ERROR
          nextItem.progress = 100
        }

        imageStore$.items[response.id]!.set(nextItem)
        inFlightTasks$[`${response.id}:${rid}`]?.delete()
      }
    }

    for (const task of errors) {
      if (!task) continue
      const item = imageStore$.items[task.id]?.peek()
      if (!item) continue

      const rid = task.resultId
      const prev = item.results[rid]
      const nextItem = { ...item }
      const merged: ImageResult = {
        ...(prev ?? {
          format: task.format,
          resultId: rid,
          status: STATUS_PROCESSING,
          variantLabel: '',
        }),
        error: ERR_WORKER,
        format: task.format,
        resultId: rid,
        status: STATUS_ERROR,
      }
      nextItem.results = {
        ...item.results,
        [rid]: merged,
      }

      if (isTerminal(nextItem)) {
        nextItem.status = STATUS_ERROR
        nextItem.progress = 100
      }

      imageStore$.items[task.id]!.set(nextItem)
      inFlightTasks$[`${task.id}:${rid}`]?.delete()
    }
  })
}

export async function destroyPool() {
  if (pool) {
    await pool.destroy()
    pool = null
  }
}

export function getPool(): WorkerPool {
  if (pool) return pool
  pool = new WorkerPool(computeConcurrency(), {
    onActiveCountChange: (count) => {
      batch(() => {
        poolStats$.activeCount.set(count)
        if (pool) {
          poolStats$.limit.set(pool.concurrencyLimit)
        }
      })
    },
    onError: (_workerIndex, task) => {
      applyWorkerError(task)
    },
    onMessage: (_workerIndex, data) => {
      applyWorkerResult(data as WorkerOutbound)
    },
  })
  return pool
}

export async function processNextAsync(options: GlobalOptions): Promise<void> {
  if (isScheduling) return
  isScheduling = true

  try {
    const currentPool = getPool()
    const inFlightCount = Object.keys(inFlightTasks$.peek()).length
    const limit = poolStats$.limit.peek()
    const remainingCapacity = limit - inFlightCount

    if (remainingCapacity <= 0) return

    const pending = pendingTasks$.peek()
    if (pending.length === 0) return

    const isLargeBusy = isLargeFileInFlight$.peek()
    if (isLargeBusy) return

    const items = imageStore$.items.peek()
    let capacity = remainingCapacity

    const tasksByItem = new Map<string, { isLarge: boolean; resultIds: string[] }>()
    for (const p of pending) {
      if (!tasksByItem.has(p.itemId)) {
        tasksByItem.set(p.itemId, { isLarge: p.isLarge, resultIds: [] })
      }
      tasksByItem.get(p.itemId)!.resultIds.push(p.resultId)
    }

    for (const [itemId, info] of tasksByItem) {
      if (capacity <= 0) break

      const item = items[itemId]
      if (!item) continue

      if (info.isLarge) {
        if (inFlightCount > 0 || capacity < remainingCapacity) {
          break
        }
        const sourceFile = await resolveOriginalSourceFile(itemId, item)
        if (!sourceFile) continue

        const toDispatch = info.resultIds.slice(0, Math.min(2, capacity))
        const count = dispatchRowToPool(itemId, item, sourceFile, currentPool, options, toDispatch)
        capacity -= count
        break
      }

      const sourceFile = await resolveOriginalSourceFile(itemId, item)
      if (!sourceFile) continue

      const toDispatch = info.resultIds.slice(0, capacity)
      const count = dispatchRowToPool(itemId, item, sourceFile, currentPool, options, toDispatch)

      capacity -= count
    }
  } finally {
    isScheduling = false
  }
}

function dispatchRowToPool(
  id: string,
  candidateItem: ImageItem,
  sourceFile: File,
  currentPool: WorkerPool,
  options: GlobalOptions,
  resultIds: string[],
): number {
  const processingItem: ImageItem = {
    ...candidateItem,
    status: STATUS_PROCESSING,
  }
  let dispatchedCount = 0

  const slots = buildOutputSlots(processingItem, options)

  batch(() => {
    for (const rid of resultIds) {
      const res = processingItem.results[rid]
      if (!res || res.status === STATUS_SUCCESS || res.status === STATUS_PROCESSING) continue

      const slot = slots.find((s) => s.resultId === rid)
      if (!slot) continue

      const task: Task = {
        file: sourceFile,
        format: slot.format,
        id: processingItem.id,
        options: {
          format: slot.format,
          losslessEncoding: options.losslessEncoding,
          originalExtension: processingItem.originalFormat,
          originalSize: processingItem.originalSize,
          qualityPercent: processingItem.qualityPercentOverride ?? options.qualityPercent,
          resizePreset: slot.resizePreset,
          resultId: rid,
          stripMetadata: options.stripMetadata,
          svgDisplayDpr: 2,
          svgExportDensity: 'display' as const,
          svgInternalFormat: options.svgInternalFormat,
          svgRasterizer: 'resvg' as const,
        },
        resultId: rid,
      }

      currentPool.addTask(task)
      processingItem.results = {
        ...processingItem.results,
        [rid]: { ...res, status: STATUS_PROCESSING },
      }
      inFlightTasks$[`${id}:${rid}`]!.set(true)
      dispatchedCount++
    }

    imageStore$.items[id]!.set(processingItem)
  })

  return dispatchedCount
}

function isTerminal(item: ImageItem): boolean {
  return !Object.values(item.results).some(
    (r) => r.status === 'processing' || r.status === 'pending',
  )
}

// Reactive queue scheduler
observe(() => {
  const pending = pendingTasks$.get()
  const inFlight = inFlightTasks$.get()
  const inFlightCount = Object.keys(inFlight).length
  const limit = poolStats$.limit.get()
  const isLargeBusy = isLargeFileInFlight$.get()
  const isIntakeActive = intake$.active.get()

  if (inFlightCount > 0) {
    const items = imageStore$.items
    batch(() => {
      for (const taskId in inFlight) {
        if (!inFlight[taskId]) continue
        const [itemId, rid] = taskId.split(':') as [string, string]
        const item = items[itemId]?.peek()
        if (!item || item.results[rid]?.status !== STATUS_PROCESSING) {
          console.warn(`[Scheduler] Found zombie in-flight task ${taskId}, cleaning up`)
          inFlightTasks$[taskId]?.delete()
        }
      }
    })
  }

  if (pending.length > 0 && inFlightCount < limit && !isLargeBusy && !isIntakeActive) {
    void processNextAsync(useSettingsStore.getState().options)
  }
})
