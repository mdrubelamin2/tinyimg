import { nanoid } from 'nanoid'

import type { IntakeOriginalKind } from '@/lib/queue/queue-intake'
import type { ImageItem, ImageResult } from '@/lib/queue/types'

import {
  DEFAULT_MIME,
  type GlobalOptions,
  ID_RANDOM_LENGTH,
  STATUS_PENDING,
  STATUS_PROCESSING,
  STATUS_SUCCESS,
} from '@/constants'
import { revokeResultUrls } from '@/lib/download'
import { buildOutputSlots } from '@/lib/queue/output-slots'

import { shouldUseLosslessRasterEncode } from '../codecs/raster/output-encode'

export { getFormatsToProcess } from '@/lib/queue/formats-to-process'

export function createQueueItem(
  file: File,
  options: GlobalOptions,
  intakeKind: IntakeOriginalKind,
  dimensions?: { height: number; width: number },
): ImageItem {
  if (/\.zip$/i.test(file.name)) {
    throw new Error(
      'Queue items must not be created for raw .zip archives (expand in intake first)',
    )
  }

  const item: ImageItem = {
    fileName: file.name,
    height: dimensions?.height,
    id: nanoid(ID_RANDOM_LENGTH),
    mimeType: file.type || DEFAULT_MIME,
    originalFormat: file.name.split('.').pop()?.toLowerCase() ?? 'unknown',
    originalSize: file.size,
    originalSourceKind: intakeKind === 'direct' ? 'direct' : 'storage',
    progress: 0,
    results: {},
    status: STATUS_PENDING,
    width: dimensions?.width,
  }

  const slots = buildOutputSlots(item, options)
  for (const slot of slots) {
    item.results[slot.resultId] = {
      format: slot.format,
      resultId: slot.resultId,
      status: STATUS_PENDING,
      variantLabel: slot.variantLabel,
    }
  }

  return item
}

/**
 * Update results when applying new global options.
 * Keeps SUCCESS results that are still valid, aborts tasks that are no longer needed,
 * and resets results that are new or were PENDING/FAILED.
 *
 * Returns:
 * - updated item with new results structure
 * - set of resultIds to cancel (for in-flight tasks that are no longer valid)
 */
export function resetItemResultsForOptions(
  item: ImageItem,
  options: GlobalOptions,
): {
  nextItem: ImageItem
  resultIdsToCancel: string[]
} {
  const newSlots = buildOutputSlots(item, options)
  const newSlotsByResultId = new Map(newSlots.map((s) => [s.resultId, s]))
  const results: Record<string, ImageResult> = {}
  const resultIdsToCancel: string[] = []

  // Preserve existing SUCCESS results or reset everything else
  for (const newSlot of newSlots) {
    const oldResult = item.results[newSlot.resultId]

    const resetEncode = (() => {
      if (oldResult?.status !== STATUS_SUCCESS) return true
      return (
        oldResult.lossless !==
        shouldUseLosslessRasterEncode(options.losslessEncoding, newSlot.resizePreset)
      )
    })()
    if (
      oldResult &&
      !resetEncode &&
      (oldResult.status === STATUS_SUCCESS || oldResult.status === STATUS_PROCESSING)
    ) {
      // Keep SUCCESS result if it still exists in new slots
      results[newSlot.resultId] = oldResult
    } else {
      // If we are resetting a PROCESSING task, it MUST be cancelled in the worker pool
      if (oldResult?.status === STATUS_PROCESSING) {
        resultIdsToCancel.push(newSlot.resultId)
      } else if (oldResult?.status === STATUS_SUCCESS) {
        revokeResultUrls({
          results: { [newSlot.resultId]: oldResult },
        } as ImageItem)
      }
      // Reset PENDING, ERROR, or new results to PENDING
      results[newSlot.resultId] = {
        format: newSlot.format,
        resultId: newSlot.resultId,
        status: STATUS_PENDING,
        variantLabel: newSlot.variantLabel,
      }
    }
  }

  // Identify old results that are no longer in the new configuration
  for (const resultId in item.results) {
    if (!newSlotsByResultId.has(resultId)) {
      const oldResult = item.results[resultId]
      if (oldResult?.status === STATUS_PROCESSING) {
        // Cancel in-flight tasks that are no longer needed
        resultIdsToCancel.push(resultId)
      } else {
        revokeResultUrls({ results: { [resultId]: oldResult } } as ImageItem)
      }
    }
  }

  // Determine new item status: stays PENDING if any result is PENDING, otherwise check for completion
  const hasAnyPending = Object.values(results).some((r) => r.status === STATUS_PENDING)
  const hasAnyProcessing = Object.values(results).some((r) => r.status === STATUS_PROCESSING)

  const nextItem: ImageItem = {
    ...item,
    progress: hasAnyPending ? 0 : item.progress,
    results,
    status: hasAnyPending && !hasAnyProcessing ? STATUS_PENDING : item.status,
  }

  return { nextItem, resultIdsToCancel }
}
