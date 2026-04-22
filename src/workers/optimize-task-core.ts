/**
 * Shared optimize implementation: runs in the poolifier ThreadWorker. Keep imports worker-safe.
 */

import {
  TASK_TIMEOUT_MS,
  ERR_TASK_TIMEOUT,
  BYTES_PER_KB,
} from '@/constants';
import type { SvgInternalFormat } from '@/constants';
import { Logger } from './logger';
import { classifyContent } from './classify';
import {
  getImageData,
  checkPixelLimit,
  normalizeOutputFormat,
  toErrorMessage,
} from './raster-encode';
import { encodeBitmapRasterForOutput, encodeSvgRasterForOutput } from '@/lib/codecs/raster/output-encode';
import { resizeImageDataHighQuality } from '@/lib/codecs/raster/resize-jsquash';
import {
  processSvg,
  isSvgRasterFormat,
  rasterizeSvgFileToImageData,
  assertEncodedDimensions,
} from './svg-pipeline';
import { resolveResizeTarget } from './resize-preset';
import type { TaskOptions, WorkerOutbound } from '@/lib/queue/types';
import { PRESETS } from '@/lib/codecs/raster/presets';
import type { RasterEncodePreset } from '@/lib/codecs/raster/types';
import {
  applyScaleBoostToPreset,
  computeDownscaleRatio,
  qualityBoostFromRatio,
} from '@/lib/codecs/raster/adaptive-quality';

export interface OptimizeTaskInput {
  id: string;
  file: File;
  options: TaskOptions;
}

export interface OptimizeOptions {
  format: 'original' | 'webp' | 'avif' | 'jpeg' | 'png' | 'svg';
  svgInternalFormat: SvgInternalFormat;
  svgRasterizer?: 'auto' | 'browser' | 'resvg';
  svgExportDensity?: 'legacy' | 'display';
  svgDisplayDpr?: number;
}

function svgPipelineOptionsFromWorker(options: OptimizeOptions) {
  return {
    svgInternalFormat: options.svgInternalFormat ?? ('webp' as const),
    svgRasterizer: options.svgRasterizer ?? ('resvg' as const),
    svgExportDensity: options.svgExportDensity ?? ('display' as const),
    svgDisplayDpr: options.svgDisplayDpr ?? 2,
  };
}

/**
 * Runs one optimization job and returns the wire message (RESULT or ERROR).
 */
export async function runOptimizeTask(input: OptimizeTaskInput): Promise<WorkerOutbound> {
  const { file, options, id } = input;
  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase();
  const requestedFormat = options.format;
  const resultId = options.resultId;
  const finalFormat = normalizeOutputFormat(options.format, extension);

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
    let encodedBytes: ArrayBuffer;
    let mimeType: string;
    let label: string;
    let isLossless = false;

    if (extension === 'svg' || options.format === 'svg') {
      if (isSvgRasterFormat(requestedFormat)) {
        const svgOpts = svgPipelineOptionsFromWorker(options as OptimizeOptions);
        const rasterPack = await rasterizeSvgFileToImageData(file, svgOpts);
        let imageData = rasterPack.imageData;
        const srcW = imageData.width;
        const srcH = imageData.height;

        const target = resolveResizeTarget(imageData.width, imageData.height, options.resizePreset);
        if (target && (target.width !== imageData.width || target.height !== imageData.height)) {
          imageData = await resizeImageDataHighQuality(imageData, target.width, target.height);
        }

        checkPixelLimit(imageData.width, imageData.height);

        const format = requestedFormat as 'avif' | 'webp' | 'jpeg' | 'png';
        const { data: bytes, lossless } = await encodeSvgRasterForOutput(imageData, format, {
          losslessEncoding: options.losslessEncoding,
          resizePreset: options.resizePreset,
          srcW,
          srcH,
        });

        const mt = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
        await assertEncodedDimensions(bytes, mt, imageData.width, imageData.height);

        encodedBytes = bytes;
        isLossless = lossless;
        mimeType = mt;
        label = `${format}`;
      } else {
        const res = await processSvg(file, svgPipelineOptionsFromWorker(options as OptimizeOptions));
        encodedBytes = await res.blob.arrayBuffer();
        mimeType = res.blob.type || 'image/svg+xml';
        label = res.label;
        isLossless = true;
      }
    } else {
      let imageBitmap: ImageBitmap;
      try {
        imageBitmap = await createImageBitmap(file);
      } catch {
        throw new Error('Unsupported or corrupt image');
      }
      let imageData = await getImageData(imageBitmap);
      try {
        imageBitmap.close();
      } catch {
        /* ignore */
      }
      checkPixelLimit(imageData.width, imageData.height);

      const srcW = imageData.width;
      const srcH = imageData.height;

      const target = resolveResizeTarget(imageData.width, imageData.height, options.resizePreset);
      if (target && (target.width !== imageData.width || target.height !== imageData.height)) {
        imageData = await resizeImageDataHighQuality(imageData, target.width, target.height);
      }

      checkPixelLimit(imageData.width, imageData.height);
      const preset = classifyContent(imageData);

      const effectiveFormat = finalFormat === 'svg' ? 'webp' : finalFormat;
      const fmt = effectiveFormat as 'avif' | 'webp' | 'jpeg' | 'png';
      const downscaleRatio = computeDownscaleRatio(srcW, srcH, imageData.width, imageData.height);
      const boost = qualityBoostFromRatio(downscaleRatio);
      const boostedByContent =
        boost > 0
          ? {
              photo: applyScaleBoostToPreset(
                PRESETS.photo as unknown as RasterEncodePreset,
                fmt,
                boost,
                'photo'
              ),
              ...(preset === 'graphic'
                ? {
                    graphic: applyScaleBoostToPreset(
                      PRESETS.graphic as unknown as RasterEncodePreset,
                      fmt,
                      boost,
                      'graphic'
                    ),
                  }
                : {}),
            }
          : undefined;
      const { data: bytesArray, lossless } = await encodeBitmapRasterForOutput(imageData, effectiveFormat, {
        losslessEncoding: options.losslessEncoding,
        resizePreset: options.resizePreset,
        preset,
        ...(boostedByContent !== undefined ? { boostedByContent } : {}),
      });

      const mimeFormat = effectiveFormat === 'jpeg' ? 'jpeg' : effectiveFormat;
      encodedBytes = bytesArray;
      isLossless = lossless;
      mimeType = `image/${mimeFormat}`;
      label = effectiveFormat;
    }

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
      savingsPercent: Math.round(Math.abs(((file.size - outSize) / file.size) * 100)),
    });
  } catch (error) {
    const errorText = toErrorMessage(error, 'Optimization failed');
    Logger.error('Optimization failed', {
      fileName,
      extension,
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
