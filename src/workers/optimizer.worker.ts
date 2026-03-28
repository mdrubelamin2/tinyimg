/**
 * Optimizer worker entry: message handler, timeout, and coordination of SVG vs raster paths.
 * Delegates to svg-pipeline and raster-encode; thin coordinator.
 */

import {
  TASK_TIMEOUT_MS,
  ERR_TASK_TIMEOUT,
} from '@/constants';
import type { SvgInternalFormat } from '@/constants';
import { classifyContent } from './classify';
import {
  getImageData,
  checkPixelLimit,
  normalizeOutputFormat,
  encodeRasterWithFallback,
  toErrorMessage,
} from './raster-encode';
import { processSvg, rasterizeSvgToFormat, isSvgRasterFormat } from './svg-pipeline';

export interface OptimizeOptions {
  format: 'original' | 'webp' | 'avif' | 'jpeg' | 'png' | 'svg';
  svgInternalFormat: SvgInternalFormat;
  svgRasterizer?: 'auto' | 'browser' | 'resvg';
  svgExportDensity?: 'legacy' | 'display';
  svgDisplayDpr?: number;
}

function svgPipelineOptionsFromWorker(options: OptimizeOptions) {
  return {
    svgInternalFormat: options.svgInternalFormat ?? 'webp' as const,
    svgRasterizer: options.svgRasterizer ?? 'resvg' as const,
    svgExportDensity: options.svgExportDensity ?? 'display' as const,
    svgDisplayDpr: options.svgDisplayDpr ?? 2,
  };
}

self.onmessage = async (e: MessageEvent) => {
  const { file, options, id } = e.data;
  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase();
  const requestedFormat = options.format;
  const finalFormat = normalizeOutputFormat(options.format, extension);

  const perf =
    typeof performance !== 'undefined' && typeof performance.mark === 'function'
      ? performance
      : null;
  perf?.mark('opt-task-start');

  let settled = false;

  const finish = (payload: unknown) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    self.postMessage(payload);
  };

  const timeoutId = setTimeout(() => {
    finish({ id, format: requestedFormat, status: 'error', error: ERR_TASK_TIMEOUT });
  }, TASK_TIMEOUT_MS);

  try {
    let resultBlob: Blob;
    let label: string;
    let timing: {
      decodeMs?: number | undefined;
      classifyMs?: number | undefined;
      encodeMs?: number | undefined;
      svgoMs?: number | undefined;
      naturalSizeMs?: number | undefined;
      renderMs?: number | undefined;
      downscaleMs?: number | undefined;
      totalMs?: number | undefined;
      svgRasterizerPath?: 'browser' | 'resvg' | undefined;
      svgEffectiveDpr?: number | undefined;
    } | undefined;

    if (extension === 'svg' || options.format === 'svg') {
      if (isSvgRasterFormat(requestedFormat)) {
        const result = await rasterizeSvgToFormat(file, {
          format: requestedFormat,
          ...svgPipelineOptionsFromWorker(options),
        });
        resultBlob = result.blob;
        label = result.label;
        timing = result.timing;
      } else {
        const result = await processSvg(file, svgPipelineOptionsFromWorker(options));
        resultBlob = result.blob;
        label = result.label;
        timing = result.timing;
      }
    } else {
      let imageBitmap: ImageBitmap;
      try {
        imageBitmap = await createImageBitmap(file);
      } catch {
        throw new Error('Unsupported or corrupt image');
      }
      const imageData = await getImageData(imageBitmap);
      perf?.mark('opt-decode-end');
      checkPixelLimit(imageData.width, imageData.height);
      const preset = classifyContent(imageData);
      perf?.mark('opt-classify-end');

      const effectiveFormat = finalFormat === 'svg' ? 'webp' : finalFormat;
      const bytesArray = await encodeRasterWithFallback(imageData, effectiveFormat, preset);
      perf?.mark('opt-encode-end');

      const mimeFormat = effectiveFormat === 'jpeg' ? 'jpeg' : effectiveFormat;
      resultBlob = new Blob([bytesArray], {
        type: `image/${mimeFormat}`,
      });
      label = effectiveFormat;
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
    }

    finish({
      id,
      blob: resultBlob,
      size: resultBlob.size,
      format: requestedFormat,
      label,
      status: 'success',
      timing,
    });
  } catch (error) {
    finish({
      id,
      format: requestedFormat,
      status: 'error',
      error: toErrorMessage(error, 'Optimization failed'),
    });
  }
};
