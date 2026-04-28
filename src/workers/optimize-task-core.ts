/**
 * Shared optimize implementation: runs in the poolifier ThreadWorker. Keep imports worker-safe.
 */

import type { WorkerOutbound } from '@/lib/queue/types'

import { BYTES_PER_KB, ERR_TASK_TIMEOUT, TASK_TIMEOUT_MS } from '@/constants'

import type { EncoderStrategy, OptimizeTaskInput } from './encoder-types'

import { BitmapEncoderStrategy } from './encoder-bitmap'
import { SvgEncoderStrategy } from './encoder-svg'
import { Logger } from './logger'
import { toErrorMessage } from './raster-encode'

/**
 * Runs one optimization job and returns the wire message (RESULT or ERROR).
 */
export async function runOptimizeTask(input: OptimizeTaskInput): Promise<WorkerOutbound> {
  const { id, options } = input
  const requestedFormat = options.format
  const resultId = options.resultId
  const originalExtension = options.originalExtension ?? ''
  const originalSize = options.originalSize

  let settled = false
  let result: undefined | WorkerOutbound

  const finish = (payload: WorkerOutbound): void => {
    if (settled) return
    settled = true
    clearTimeout(timeoutId)
    result = payload
  }

  const timeoutId = setTimeout(() => {
    finish({
      error: ERR_TASK_TIMEOUT,
      format: requestedFormat,
      id,
      resultId,
      type: 'ERROR',
    })
  }, TASK_TIMEOUT_MS)

  try {
    const strategy: EncoderStrategy =
      originalExtension === 'svg' || options.format === 'svg'
        ? new SvgEncoderStrategy()
        : new BitmapEncoderStrategy()

    const { encodedBytes, isLossless, label, mimeType } = await strategy.encode(input)

    const outSize = encodedBytes.byteLength
    finish({
      encodedBytes,
      format: requestedFormat,
      formattedSize: (outSize / BYTES_PER_KB).toFixed(1),
      id,
      label,
      lossless: isLossless,
      mimeType,
      resultId,
      savingsPercent: Math.round(Math.abs(((originalSize - outSize) / originalSize) * 100)),
      size: outSize,
      type: 'RESULT',
    })
  } catch (error) {
    const errorText = toErrorMessage(error, 'Optimization failed')
    Logger.error('Optimization failed', {
      extension: originalExtension,
      message: errorText,
      requestedFormat,
      ...(error instanceof Error
        ? {
            cause: (error as Error & { cause?: unknown }).cause,
            name: error.name,
            stack: error.stack,
          }
        : { thrownType: typeof error }),
    })
    finish({
      error: errorText,
      format: requestedFormat,
      id,
      resultId,
      type: 'ERROR',
    })
  }

  return result!
}
