import { batch } from '@legendapp/state'
import { toast } from 'sonner'

import type { ImageItem, WorkerOutboundResult } from '@/lib/queue/types'

import {
  ERR_PERSIST_FAILED,
  ERR_PERSIST_STORAGE_FULL,
  RESULT_PERSIST_BATCH_MAX_BYTES,
  RESULT_PERSIST_BATCH_MAX_ITEMS,
  STATUS_ERROR,
  STATUS_SUCCESS,
} from '@/constants'
import { heapMetrics } from '@/lib/dev/heap-metrics'
import { persistEncodedOutput } from '@/storage/queue-binary'
import { isQuotaExceededError } from '@/storage/quota'
import { imageStore$, inFlightTasks$ } from '@/store/queue-store'

let lastPersistErrorToastAt = 0
const PERSIST_ERROR_TOAST_COOLDOWN_MS = 4000

function applyPersistFailure(response: WorkerOutboundResult, errorMessage: string): void {
  batch(() => {
    const item = imageStore$.items[response.id]?.peek()
    if (!item) return
    const rid = response.resultId
    const result = item.results[rid]
    if (!result) return

    const nextItem = {
      ...item,
      results: {
        ...item.results,
        [rid]: { ...result, error: errorMessage, status: STATUS_ERROR },
      },
    }

    if (isTerminal(nextItem)) {
      const anyError = Object.values(nextItem.results).some((r) => r.status === STATUS_ERROR)
      nextItem.status = anyError ? STATUS_ERROR : STATUS_SUCCESS
      nextItem.progress = 100
    }

    imageStore$.items[response.id]!.set(nextItem)
    inFlightTasks$[`${response.id}:${rid}`]!.delete()
  })
}

function isTerminal(item: ImageItem): boolean {
  return !Object.values(item.results).some(
    (r) => r.status === 'processing' || r.status === 'pending',
  )
}

function maybeToastPersistError(message: string): void {
  const now = Date.now()
  if (now - lastPersistErrorToastAt < PERSIST_ERROR_TOAST_COOLDOWN_MS) return
  lastPersistErrorToastAt = now
  toast.error(message, { id: 'persist-error' })
}

/** Serializes persist work to prevent side effects and out-of-sync state. */
let resultPersistChain: Promise<void> = Promise.resolve()

/** Split RESULT batches so the main thread does not retain multiple huge `ArrayBuffer`s at once. */
export function chunkResultResponsesForPersist(
  results: WorkerOutboundResult[],
): WorkerOutboundResult[][] {
  if (results.length === 0) return []
  const chunks: WorkerOutboundResult[][] = []
  let current: WorkerOutboundResult[] = []
  let currentBytes = 0
  for (const r of results) {
    const b = r.encodedBytes.byteLength
    const overItems = current.length >= RESULT_PERSIST_BATCH_MAX_ITEMS
    const overBytes = current.length > 0 && currentBytes + b > RESULT_PERSIST_BATCH_MAX_BYTES
    if (current.length > 0 && (overItems || overBytes)) {
      chunks.push(current)
      current = []
      currentBytes = 0
    }
    current.push(r)
    currentBytes += b
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

export function resetPersistChain() {
  resultPersistChain = Promise.resolve()
}

export function schedulePersistWorkerResults(results: WorkerOutboundResult[]): void {
  if (results.length === 0) return
  const totalBytes = results.reduce((sum, r) => sum + r.encodedBytes.byteLength, 0)
  heapMetrics.resultBatchReceived(results.length, totalBytes)
  const queue = [...results]

  resultPersistChain = resultPersistChain
    .then(async () => {
      while (queue.length > 0) {
        let response: null | WorkerOutboundResult = queue.shift()!
        if (!response) continue
        const byteLen = response.encodedBytes.byteLength
        heapMetrics.persistPipelineEnter()
        const t0 = performance.now()
        try {
          const snapshot = imageStore$.items[response.id]?.peek()
          if (!snapshot) continue
          const rid = response.resultId
          const prevResult = snapshot.results[rid]
          if (!prevResult) continue

          if (prevResult.downloadUrl) URL.revokeObjectURL(prevResult.downloadUrl)
          try {
            const { payloadKey } = await persistEncodedOutput(
              response.id,
              rid,
              response.encodedBytes,
              response.mimeType,
            )

            batch(() => {
              const item = imageStore$.items[response!.id]?.peek()
              if (!item) return
              const result = item.results[rid]
              if (!result) return

              const nextItem = {
                ...item,
                results: {
                  ...item.results,
                  [rid]: {
                    ...result,
                    downloadUrl: undefined,
                    formattedSize: response!.formattedSize,
                    label: response!.label,
                    lossless: response!.lossless,
                    payloadKey,
                    savingsPercent: response!.savingsPercent,
                    size: response!.size,
                    status: STATUS_SUCCESS,
                  },
                },
              }

              if (isTerminal(nextItem)) {
                const anyError = Object.values(nextItem.results).some(
                  (r) => r.status === STATUS_ERROR,
                )
                nextItem.status = anyError ? STATUS_ERROR : STATUS_SUCCESS
                nextItem.progress = 100
              }

              imageStore$.items[response!.id]!.set(nextItem)
              inFlightTasks$[`${response!.id}:${rid}`]!.delete()
            })
          } catch (error) {
            const msg = isQuotaExceededError(error) ? ERR_PERSIST_STORAGE_FULL : ERR_PERSIST_FAILED
            maybeToastPersistError(msg)
            applyPersistFailure(response, msg)
          }
        } finally {
          heapMetrics.persistDurationMs(performance.now() - t0, byteLen)
          heapMetrics.persistPipelineExit()
          if (response) {
            response.encodedBytes = null as unknown as ArrayBuffer
            response = null
          }
        }
      }
    })
    .catch((error) => {
      console.error('result persist chain (unexpected)', error)
    })
}
