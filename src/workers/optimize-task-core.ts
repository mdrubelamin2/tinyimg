/**
 * Shared optimize implementation: runs in the poolifier ThreadWorker. Keep imports worker-safe.
 */

import {
  TASK_TIMEOUT_MS,
  BYTES_PER_KB,
  ERR_TASK_TIMEOUT,
} from '@/constants';
import { Logger } from './logger';
import { toErrorMessage } from './raster-encode';
import type { WorkerOutbound } from '@/lib/queue/types';
import { SvgEncoderStrategy } from './encoder-svg';
import { BitmapEncoderStrategy } from './encoder-bitmap';
import type { OptimizeTaskInput, EncoderStrategy } from './encoder-types';

/**
 * Runs one optimization job and returns the wire message (RESULT or ERROR).
 */
export async function runOptimizeTask(input: OptimizeTaskInput): Promise<WorkerOutbound> {
  const { options, id } = input;
  const requestedFormat = options.format;
  const resultId = options.resultId;
  const originalExtension = options.originalExtension ?? '';
  const originalSize = options.originalSize;

  let settled = false;
  let result: WorkerOutbound | undefined;

  const finish = (payload: WorkerOutbound): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    result = payload;
  };

  const timeoutId = setTimeout(() => {
    finish({
      type: 'ERROR',
      id,
      resultId,
      format: requestedFormat,
      error: ERR_TASK_TIMEOUT,
    });
  }, TASK_TIMEOUT_MS);

  try {
    const strategy: EncoderStrategy = (originalExtension === 'svg' || options.format === 'svg')
      ? new SvgEncoderStrategy()
      : new BitmapEncoderStrategy();

    const { encodedBytes, mimeType, label, isLossless } = await strategy.encode(input);

    const outSize = encodedBytes.byteLength;
    finish({
      type: 'RESULT',
      id,
      resultId,
      format: requestedFormat,
      encodedBytes,
      mimeType,
      size: outSize,
      label,
      lossless: isLossless,
      formattedSize: (outSize / BYTES_PER_KB).toFixed(1),
      savingsPercent: Math.round(Math.abs(((originalSize - outSize) / originalSize) * 100)),
    });
  } catch (error) {
    const errorText = toErrorMessage(error, 'Optimization failed');
    Logger.error('Optimization failed', {
      extension: originalExtension,
      requestedFormat,
      message: errorText,
      ...(error instanceof Error
        ? {
            name: error.name,
            stack: error.stack,
            cause: (error as Error & { cause?: unknown }).cause,
          }
        : { thrownType: typeof error }),
    });
    finish({
      type: 'ERROR',
      id,
      resultId,
      format: requestedFormat,
      error: errorText,
    });
  }

  return result!;
}
