import { batch, observable, observe } from '@legendapp/state'
import { toast } from 'sonner'

import type { ImageItem } from '@/lib/queue/types'

import { syncIntakeProgressToast } from '@/notifications/toast-emitter'
import { imageStore$, intake$ } from '@/store/image-store'

import { QueueStatsAggregator } from './queue-stats-incremental'

export interface QueueStats {
  allDone: boolean
  /** Every row finished with success (e.g. confetti, no errors). */
  allSuccessful: boolean
  doneCount: number
  /** Typical savings % × bytes for pending/processing rows (UI hint only). */
  estimatedOptimizedBytes: number
  estimatedSavingsLabel: string
  hasFinishedItems: boolean
  itemCount: number
  processingCount: number
  savingsPercent: string
  successfulCount: number
  successfulOutputCount: number
  totalOutputCount: number
}

const statsAggregator = new QueueStatsAggregator()
const trackedItemObservers = new Set<string>()

function flushIncrementalStats(): QueueStats {
  return statsAggregator.toStats()
}

function observeItemStats(id: string): void {
  observe(() => {
    const node = imageStore$.items[id]
    if (!node) return
    node.status.get()
    node.results.get()
    const item = node.peek() as ImageItem | undefined
    if (item) statsAggregator.upsertItem(id, item)
    scheduleStatsFlush()
  })
}

function statsEqual(a: QueueStats, b: QueueStats): boolean {
  return (
    a.savingsPercent === b.savingsPercent &&
    a.allDone === b.allDone &&
    a.successfulCount === b.successfulCount &&
    a.hasFinishedItems === b.hasFinishedItems &&
    a.processingCount === b.processingCount &&
    a.doneCount === b.doneCount &&
    a.itemCount === b.itemCount &&
    a.estimatedOptimizedBytes === b.estimatedOptimizedBytes &&
    a.estimatedSavingsLabel === b.estimatedSavingsLabel &&
    a.allSuccessful === b.allSuccessful &&
    a.totalOutputCount === b.totalOutputCount &&
    a.successfulOutputCount === b.successfulOutputCount
  )
}

/**
 * Aggregated queue metrics for the UI. Updates are debounced to at most once per animation frame
 * when the store churns (e.g. many worker completions per frame), capping main-thread work.
 */
export const queueStats$ = observable<QueueStats>(flushIncrementalStats())

let rafId = 0
let confettiFiredForAllSuccessful = false

function maybeFireAllSuccessfulConfetti(prev: QueueStats, next: QueueStats): void {
  if (!next.allSuccessful) {
    confettiFiredForAllSuccessful = false
    return
  }
  if (prev.allSuccessful || confettiFiredForAllSuccessful) return
  confettiFiredForAllSuccessful = true
}

function scheduleStatsFlush(): void {
  if (rafId !== 0) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    const next = flushIncrementalStats()
    const prev = queueStats$.peek()
    if (statsEqual(prev, next)) return
    maybeFireAllSuccessfulConfetti(prev, next)
    batch(() => {
      queueStats$.set(next)
    })
  })
}

function showStatToast(stats: QueueStats): void {
  if (stats.processingCount > 0) {
    toast.loading(
      `Optimized ${stats.successfulOutputCount} of ${stats.totalOutputCount} image${stats.processingCount > 1 ? 's' : ''}... Saved ${stats.savingsPercent}% so far!`,
      { id: 'progress-toast' },
    )
  }
  if (stats.allDone && !stats.allSuccessful) {
    const failed = stats.totalOutputCount - stats.successfulOutputCount
    toast.warning(
      `Optimized ${stats.successfulOutputCount} image${stats.successfulCount > 1 ? 's' : ''}! Total savings: ${stats.savingsPercent}%. ${failed} image${failed > 1 ? 's' : ''} failed to optimize.`,
      { id: 'progress-toast' },
    )
  }
  if (stats.allSuccessful) {
    toast.success(
      `Optimized ${stats.successfulOutputCount} image${stats.successfulCount > 1 ? 's' : ''}! Total savings: ${stats.savingsPercent}%`,
      { id: 'progress-toast' },
    )
  }
}

observe(() => {
  const order = imageStore$.itemOrder.get()
  statsAggregator.setItemCount(order.length)

  for (const id of order) {
    if (!trackedItemObservers.has(id)) {
      trackedItemObservers.add(id)
      observeItemStats(id)
      const item = imageStore$.items[id]?.peek() as ImageItem | undefined
      if (item) statsAggregator.upsertItem(id, item)
    }
  }

  for (const id of trackedItemObservers) {
    if (!order.includes(id)) {
      trackedItemObservers.delete(id)
      statsAggregator.removeItem(id)
    }
  }

  scheduleStatsFlush()
})

observe(() => {
  const stats = queueStats$.get()
  showStatToast(stats)
})

observe(() => {
  syncIntakeProgressToast(
    intake$.active.get(),
    intake$.label.get(),
    intake$.processed.get(),
    intake$.total.get(),
  )
})
