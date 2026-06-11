import type { ImageItem } from '@/lib/queue/types'

import { STATUS_ERROR, STATUS_PENDING, STATUS_PROCESSING, STATUS_SUCCESS } from '@/constants'

import type { QueueStats } from './queue-stats'

/** Heuristic typical savings % by MIME for pre-result estimate (instant feedback). */
const SAVINGS_TYPICAL_BY_MIME: Record<string, number> = {
  'image/avif': 15,
  'image/bmp': 50,
  'image/gif': 40,
  'image/jpeg': 35,
  'image/png': 55,
  'image/svg+xml': 35,
  'image/tiff': 30,
  'image/webp': 25,
}

interface ItemSnapshot {
  allResultsSuccess: boolean
  estimatedOptimizedBytes: number
  originalSize: number
  processing: boolean
  status: ImageItem['status']
  successfulOutputBytes: number
  successfulOutputCount: number
  terminal: boolean
  totalOutputCount: number
}

export class QueueStatsAggregator {
  private itemCount = 0
  private snapshots = new Map<string, ItemSnapshot>()
  private terminalCount = 0
  private totalEstimatedOptimizedBytes = 0
  private totalOptimizedBytes = 0
  private totalOriginalBytes = 0
  private totalOutputCount = 0
  private totalProcessing = 0
  private totalSuccessfulItems = 0
  private totalSuccessfulOutputs = 0

  clear(): void {
    this.snapshots.clear()
    this.itemCount = 0
    this.totalOriginalBytes = 0
    this.totalOptimizedBytes = 0
    this.totalEstimatedOptimizedBytes = 0
    this.totalSuccessfulItems = 0
    this.totalProcessing = 0
    this.totalOutputCount = 0
    this.totalSuccessfulOutputs = 0
    this.terminalCount = 0
  }

  removeItem(id: string): void {
    const prev = this.snapshots.get(id)
    if (!prev) return
    this.applyDelta(prev, -1)
    this.snapshots.delete(id)
    this.itemCount = Math.max(0, this.itemCount - 1)
  }

  setItemCount(count: number): void {
    this.itemCount = count
  }

  toStats(): QueueStats {
    const savingsPercent =
      this.totalOriginalBytes > 0
        ? this.totalOptimizedBytes === 0
          ? '0'
          : (
              ((this.totalOriginalBytes - this.totalOptimizedBytes) / this.totalOriginalBytes) *
              100
            ).toFixed(1)
        : '0'

    const allDone = this.itemCount > 0 && this.terminalCount === this.itemCount
    const allSuccessful =
      this.itemCount > 0 && this.totalSuccessfulItems === this.itemCount && allDone

    const estLabel =
      this.itemCount > 0 && this.totalOriginalBytes > 0
        ? `~${((1 - this.totalEstimatedOptimizedBytes / this.totalOriginalBytes) * 100).toFixed(0)}% est. while processing`
        : ''

    return {
      allDone,
      allSuccessful,
      doneCount: this.totalSuccessfulItems,
      estimatedOptimizedBytes: this.totalEstimatedOptimizedBytes,
      estimatedSavingsLabel: estLabel,
      hasFinishedItems: this.terminalCount > 0,
      itemCount: this.itemCount,
      processingCount: this.totalProcessing,
      savingsPercent,
      successfulCount: this.totalSuccessfulItems,
      successfulOutputCount: this.totalSuccessfulOutputs,
      totalOutputCount: this.totalOutputCount,
    }
  }

  upsertItem(id: string, item: ImageItem): void {
    const next = snapshotItem(item)
    const prev = this.snapshots.get(id)
    if (prev) this.applyDelta(prev, -1)
    this.applyDelta(next, 1)
    this.snapshots.set(id, next)
  }

  private applyDelta(s: ItemSnapshot, sign: -1 | 1): void {
    this.totalOriginalBytes += sign * s.originalSize
    this.totalOptimizedBytes += sign * s.successfulOutputBytes
    this.totalEstimatedOptimizedBytes += sign * s.estimatedOptimizedBytes
    this.totalOutputCount += sign * s.totalOutputCount
    this.totalSuccessfulOutputs += sign * s.successfulOutputCount
    if (s.status === STATUS_SUCCESS) this.totalSuccessfulItems += sign
    if (s.processing) this.totalProcessing += sign
    if (s.terminal) this.terminalCount += sign
    void s.allResultsSuccess
  }
}

function mimeForItem(item: ImageItem): string {
  if (item.mimeType) return item.mimeType
  const ext = item.originalFormat.toLowerCase()
  if (ext === 'jpg') return 'image/jpeg'
  return `image/${ext}`
}

function snapshotItem(item: ImageItem): ItemSnapshot {
  let successfulOutputBytes = 0
  let successfulOutputCount = 0
  let totalOutputCount = 0
  let allResultsSuccess = totalOutputCount > 0

  for (const res of Object.values(item.results)) {
    totalOutputCount += 1
    if (res.status === STATUS_SUCCESS && res.size && res.size > 0) {
      successfulOutputBytes += res.size
      successfulOutputCount += 1
    } else if (res.status !== STATUS_SUCCESS) {
      allResultsSuccess = false
    }
  }
  if (totalOutputCount === 0) allResultsSuccess = false

  let estimatedOptimizedBytes = 0
  if (item.status === STATUS_PENDING || item.status === STATUS_PROCESSING) {
    const mime = mimeForItem(item)
    const pct = SAVINGS_TYPICAL_BY_MIME[mime] ?? 28
    estimatedOptimizedBytes = item.originalSize * (1 - pct / 100)
  }

  const terminal = item.status === STATUS_SUCCESS || item.status === STATUS_ERROR

  return {
    allResultsSuccess,
    estimatedOptimizedBytes,
    originalSize: item.originalSize,
    processing: item.status === STATUS_PROCESSING,
    status: item.status,
    successfulOutputBytes,
    successfulOutputCount,
    terminal,
    totalOutputCount,
  }
}
