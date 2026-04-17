/**
 * Shared optimize implementation: runs in the poolifier ThreadWorker. Keep imports worker-safe.
 */

import {
  TASK_TIMEOUT_MS,
  ERR_TASK_TIMEOUT,
} from '@/constants';
import type { SvgInternalFormat } from '@/constants';
import { Logger } from './logger';
import { classifyContent } from './classify';
import {
  getImageData,
  checkPixelLimit,
  normalizeOutputFormat,
  encodeRasterWithFallback,
  encodeRasterVectorSafeWithSizeSafeguard,
  toErrorMessage,
} from './raster-encode';
import { resizeImageDataHighQuality } from '@/lib/codecs/raster/resize-jsquash';
import {
  processSvg,
  isSvgRasterFormat,
  rasterizeSvgFileToImageData,
  assertEncodedDimensions,
} from './svg-pipeline';
import { resolveResizeTarget } from './resize-preset';
import type { TaskOptions, WorkerOutbound } from '@/lib/queue/types';
import {
  PRESETS,
  SVG_DISPLAY_VECTOR_PRESET,
  SVG_VECTOR_SAFE_PRESET,
} from '@/lib/codecs/raster/presets';
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

  const perf =
    typeof performance !== 'undefined' && typeof performance.mark === 'function'
      ? performance
      : null;
  perf?.mark('opt-task-start');

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
    let resultBlob: Blob;
    let label: string;
    let timing:
      | {
          decodeMs?: number | undefined;
          classifyMs?: number | undefined;
          encodeMs?: number | undefined;
          resizeMs?: number | undefined;
          svgoMs?: number | undefined;
          naturalSizeMs?: number | undefined;
          renderMs?: number | undefined;
          downscaleMs?: number | undefined;
          totalMs?: number | undefined;
          svgRasterizerPath?: 'browser' | 'resvg' | undefined;
          svgEffectiveDpr?: number | undefined;
        }
      | undefined;

    if (extension === 'svg' || options.format === 'svg') {
      if (isSvgRasterFormat(requestedFormat)) {
        const svgOpts = svgPipelineOptionsFromWorker(options as OptimizeOptions);
        const rasterPack = await rasterizeSvgFileToImageData(file, svgOpts);
        let imageData = rasterPack.imageData;
        const srcW = imageData.width;
        const srcH = imageData.height;
        const svgBaseTiming = rasterPack.timing;
        perf?.mark('opt-decode-end');

        let resizeMs: number | undefined;
        const target = resolveResizeTarget(imageData.width, imageData.height, options.resizePreset);
        if (target && (target.width !== imageData.width || target.height !== imageData.height)) {
          const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
          imageData = await resizeImageDataHighQuality(imageData, target.width, target.height);
          resizeMs = Math.round(
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
          );
        }

        checkPixelLimit(imageData.width, imageData.height);
        perf?.mark('opt-classify-end');

        const format = requestedFormat as 'avif' | 'webp' | 'jpeg' | 'png';
        const downscaleRatio = computeDownscaleRatio(srcW, srcH, imageData.width, imageData.height);
        const boost = qualityBoostFromRatio(downscaleRatio);
        const displayQuality = options.svgExportDensity === 'display';
        const svgVectorBase = (
          displayQuality ? SVG_DISPLAY_VECTOR_PRESET : SVG_VECTOR_SAFE_PRESET
        ) as unknown as RasterEncodePreset;
        const lossyPreset =
          boost > 0 ? applyScaleBoostToPreset(svgVectorBase, format, boost, 'graphic') : undefined;
        const encodeStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const bytes = await encodeRasterVectorSafeWithSizeSafeguard(imageData, format, {
          displayQuality,
          ...(lossyPreset != null ? { lossyPreset } : {}),
        });
        const encodeMs = Math.round(
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - encodeStart
        );
        perf?.mark('opt-encode-end');

        const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
        await assertEncodedDimensions(bytes, mimeType, imageData.width, imageData.height);

        const pathSuffix = options.svgExportDensity === 'display' ? ` (${svgBaseTiming.svgRasterizerPath})` : '';
        resultBlob = new Blob([bytes], { type: mimeType });
        label = `${format}${pathSuffix}`;
        timing = {
          ...svgBaseTiming,
          encodeMs,
          ...(resizeMs != null ? { resizeMs } : {}),
        };
      } else {
        const res = await processSvg(file, svgPipelineOptionsFromWorker(options as OptimizeOptions));
        resultBlob = res.blob;
        label = res.label;
        timing = res.timing;
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
      perf?.mark('opt-decode-end');
      checkPixelLimit(imageData.width, imageData.height);

      const srcW = imageData.width;
      const srcH = imageData.height;

      let resizeMs: number | undefined;
      const target = resolveResizeTarget(imageData.width, imageData.height, options.resizePreset);
      if (target && (target.width !== imageData.width || target.height !== imageData.height)) {
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        imageData = await resizeImageDataHighQuality(imageData, target.width, target.height);
        resizeMs = Math.round(
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
        );
      }

      checkPixelLimit(imageData.width, imageData.height);
      const preset = classifyContent(imageData);
      perf?.mark('opt-classify-end');

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
      const bytesArray = await encodeRasterWithFallback(
        imageData,
        effectiveFormat,
        preset,
        boostedByContent
      );
      perf?.mark('opt-encode-end');

      const mimeFormat = effectiveFormat === 'jpeg' ? 'jpeg' : effectiveFormat;
      resultBlob = new Blob([bytesArray], {
        type: `image/${mimeFormat}`,
      });
      label = effectiveFormat;
      if (resizeMs != null) {
        timing = { resizeMs };
      }
    }

    if (!timing && perf && typeof perf.getEntriesByName === 'function') {
      perf.mark('opt-task-end');
      try {
        const start = perf.getEntriesByName('opt-task-start')[0]?.startTime ?? 0;
        const decodeEnd = perf.getEntriesByName('opt-decode-end')[0]?.startTime;
        const classifyEnd = perf.getEntriesByName('opt-classify-end')[0]?.startTime;
        const encodeEnd = perf.getEntriesByName('opt-encode-end')[0]?.startTime;
        const decodeMs = decodeEnd != null ? Math.round(decodeEnd - start) : undefined;
        const classifyMs =
          decodeEnd != null && classifyEnd != null ? Math.round(classifyEnd - decodeEnd) : undefined;
        const encodeMs =
          classifyEnd != null && encodeEnd != null
            ? Math.round(encodeEnd - classifyEnd)
            : undefined;
        if (decodeMs != null || classifyMs != null || encodeMs != null) {
          timing = { decodeMs, classifyMs, encodeMs };
        }
      } catch {
        timing = undefined;
      }
    } else if (timing && perf && typeof perf.getEntriesByName === 'function') {
      perf.mark('opt-task-end');
      try {
        const start = perf.getEntriesByName('opt-task-start')[0]?.startTime ?? 0;
        const decodeEnd = perf.getEntriesByName('opt-decode-end')[0]?.startTime;
        const classifyEnd = perf.getEntriesByName('opt-classify-end')[0]?.startTime;
        const encodeEnd = perf.getEntriesByName('opt-encode-end')[0]?.startTime;
        const decodeMs = decodeEnd != null ? Math.round(decodeEnd - start) : undefined;
        const classifyMs =
          decodeEnd != null && classifyEnd != null ? Math.round(classifyEnd - decodeEnd) : undefined;
        const encodeMs =
          classifyEnd != null && encodeEnd != null
            ? Math.round(encodeEnd - classifyEnd)
            : undefined;
        timing = { ...timing, decodeMs, classifyMs, encodeMs };
      } catch {
        /* keep partial timing */
      }
    }

    finish({
      type: 'RESULT',
      id,
      resultId,
      format: requestedFormat,
      blob: resultBlob,
      size: resultBlob.size,
      label,
      formattedSize: (resultBlob.size / 1024).toFixed(1),
      savingsPercent: Math.round(Math.abs(((file.size - resultBlob.size) / file.size) * 100)),
      timing,
    });
  } catch (error) {
    Logger.error('Optimization failed', {
      fileName,
      extension,
      requestedFormat,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
              cause: (error as Error & { cause?: unknown }).cause,
            }
          : error,
    });
    finish({
      type: 'ERROR',
      id,
      resultId,
      format: requestedFormat,
      error: toErrorMessage(error, 'Optimization failed'),
    });
  }

  return result!;
}
