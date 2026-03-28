/**
 * SVG pipeline: SVGO optimize, rasterize (browser-first or resvg), display-density or legacy pixel-lock, encode/wrap.
 */

import { Resvg } from '@resvg/resvg-wasm';
import {
  MAX_PIXELS,
  SVG_INTERNAL_SSAA_SCALE,
  WRAPPER_SIZE_THRESHOLD,
} from '@/constants/index';
import type { SvgInternalFormat } from '@/constants/index';
import { optimizeSvg, svgByteLength } from '@/lib/optimizer/svg-optimizer';
import { Logger } from './logger';
import { ensureResvg } from './optimizer-wasm';
import { classifyContent } from './classify';
import {
  checkPixelLimit,
  encodeRaster,
  encodeRasterVectorSafeWithSizeSafeguard,
  toBase64,
} from './raster-encode';
import type { ContentPreset } from './classify';
import { BrowserSvgRasterError, rasterizeSvgWithBrowser } from './svg-browser-raster';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_DISPLAY_DPR_MIN = 1;
const SVG_DISPLAY_DPR_MAX = 3;

type SvgRasterizer = 'auto' | 'browser' | 'resvg';
type SvgExportDensity = 'legacy' | 'display';

export interface SvgPipelineOptions {
  svgInternalFormat: SvgInternalFormat;
  svgRasterizer: SvgRasterizer;
  svgExportDensity: SvgExportDensity;
  svgDisplayDpr: number;
}

export interface SvgStageTiming {
  svgoMs?: number | undefined;
  naturalSizeMs?: number | undefined;
  renderMs?: number | undefined;
  downscaleMs?: number | undefined;
  classifyMs?: number | undefined;
  encodeMs?: number | undefined;
  totalMs?: number | undefined;
  svgRasterizerPath?: 'browser' | 'resvg' | undefined;
  /** Effective DPR used when svgExportDensity is display (may be lowered vs requested for MAX_PIXELS). */
  svgEffectiveDpr?: number | undefined;
}

interface SvgRasterizeResult {
  imageData: ImageData;
  timing: Pick<SvgStageTiming, 'renderMs' | 'downscaleMs'>;
  rasterizerPath: 'browser' | 'resvg';
  bitmapWidth: number;
  bitmapHeight: number;
  effectiveDpr?: number;
}

const RASTER_FORMATS = ['webp', 'avif', 'jpeg', 'png'] as const;
export type SvgRasterFormat = (typeof RASTER_FORMATS)[number];

export function isSvgRasterFormat(f: string): f is SvgRasterFormat {
  return RASTER_FORMATS.includes(f as SvgRasterFormat);
}

/**
 * Clamp requested DPR to 1..MAX and reduce if logical×DPR would exceed MAX_PIXELS.
 */
export function computeEffectiveDisplayDpr(
  logicalW: number,
  logicalH: number,
  requestedDpr: number
): number {
  let dpr = Math.round(Number(requestedDpr));
  if (!Number.isFinite(dpr) || dpr < SVG_DISPLAY_DPR_MIN) {
    dpr = SVG_DISPLAY_DPR_MIN;
  }
  if (dpr > SVG_DISPLAY_DPR_MAX) {
    dpr = SVG_DISPLAY_DPR_MAX;
  }
  const bw = Math.max(1, Math.round(logicalW));
  const bh = Math.max(1, Math.round(logicalH));
  while (dpr > SVG_DISPLAY_DPR_MIN) {
    const pw = Math.max(1, Math.round(bw * dpr));
    const ph = Math.max(1, Math.round(bh * dpr));
    if (pw * ph <= MAX_PIXELS) break;
    dpr -= 1;
  }
  return dpr;
}

export async function processSvg(
  file: File,
  options: SvgPipelineOptions
): Promise<{ blob: Blob; label: string; timing?: SvgStageTiming }> {
  const totalStart = nowMs();
  const text = await file.text();

  const svgoStart = nowMs();
  const { data: optimizedSvg, engine } = await optimizeSvg(text);
  const optimizedSvgSize = svgByteLength(optimizedSvg);
  const svgoMs = nowMs() - svgoStart;

  Logger.debug('SVG optimization complete', {
    engine,
    originalSize: text.length,
    optimizedSize: optimizedSvgSize,
    timeMs: Math.round(svgoMs),
  });

  const naturalSizeStart = nowMs();
  const { width, height } = await readSvgNaturalSize(optimizedSvg);
  const naturalSizeMs = nowMs() - naturalSizeStart;

  const raster = await buildSvgRaster(optimizedSvg, width, height, options);
  assertDimensions(raster.imageData.width, raster.imageData.height, raster.bitmapWidth, raster.bitmapHeight, 'post-raster');

  const classifyStart = nowMs();
  const preset: ContentPreset = classifyContent(raster.imageData);
  const classifyMs = nowMs() - classifyStart;

  const { svgInternalFormat, svgExportDensity } = options;
  const internalFormat = svgInternalFormat ?? 'webp';
  const mimeType = mimeByFormat(internalFormat);
  // JXL is not yet supported in SVG internal encode — fall back to webp
  const encodeFormat = isSvgRasterFormat(internalFormat) ? internalFormat : 'webp' as const;
  const encodeStart = nowMs();
  const internalBytes =
    svgExportDensity === 'display'
      ? await encodeRasterVectorSafeWithSizeSafeguard(raster.imageData, encodeFormat, {
          displayQuality: true,
        })
      : await encodeRaster(raster.imageData, encodeFormat, preset);
  const encodeMs = nowMs() - encodeStart;
  await assertEncodedDimensions(internalBytes, mimeType, raster.bitmapWidth, raster.bitmapHeight);

  const internalBase64 = await toBase64(internalBytes);
  const svgWrapper = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="${SVG_NS}">
  <image href="data:${mimeType};base64,${internalBase64}" width="${width}" height="${height}" />
</svg>`;
  const wrapperSize = new TextEncoder().encode(svgWrapper).length;

  const pathSuffix =
    options.svgExportDensity === 'display' ? `, ${raster.rasterizerPath}` : '';
  const timing: SvgStageTiming = {
    svgoMs: Math.round(svgoMs),
    naturalSizeMs: Math.round(naturalSizeMs),
    renderMs: raster.timing.renderMs,
    downscaleMs: raster.timing.downscaleMs,
    classifyMs: Math.round(classifyMs),
    encodeMs: Math.round(encodeMs),
    totalMs: Math.round(nowMs() - totalStart),
    svgRasterizerPath: raster.rasterizerPath,
    ...(raster.effectiveDpr != null ? { svgEffectiveDpr: raster.effectiveDpr } : {}),
  };

  if (wrapperSize < optimizedSvgSize * WRAPPER_SIZE_THRESHOLD) {
    return {
      blob: new Blob([svgWrapper], { type: 'image/svg+xml' }),
      label: `svg (${internalFormat}-wrapped${pathSuffix})`,
      timing,
    };
  }
  return {
    blob: new Blob([optimizedSvg], { type: 'image/svg+xml' }),
    label: 'svg (optimized)',
    timing,
  };
}

/**
 * Rasterize SVG to requested flat raster format (webp/avif/png/jpeg).
 */
export async function rasterizeSvgToFormat(
  file: File,
  options: { format: SvgRasterFormat } & SvgPipelineOptions
): Promise<{ blob: Blob; label: string; timing?: SvgStageTiming }> {
  const totalStart = nowMs();
  const text = await file.text();

  const naturalSizeStart = nowMs();
  const { width, height } = await readSvgNaturalSize(text);
  const naturalSizeMs = nowMs() - naturalSizeStart;

  const raster = await buildSvgRaster(text, width, height, options);
  assertDimensions(raster.imageData.width, raster.imageData.height, raster.bitmapWidth, raster.bitmapHeight, 'post-raster');

  const format = options.format;
  const encodeStart = nowMs();
  const bytes =
    options.svgExportDensity === 'display'
      ? await encodeRasterVectorSafeWithSizeSafeguard(raster.imageData, format, {
          displayQuality: true,
        })
      : await encodeRasterVectorSafeWithSizeSafeguard(raster.imageData, format);
  const encodeMs = nowMs() - encodeStart;
  const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
  await assertEncodedDimensions(bytes, mimeType, raster.bitmapWidth, raster.bitmapHeight);

  const pathSuffix = options.svgExportDensity === 'display' ? ` (${raster.rasterizerPath})` : '';

  const timing: SvgStageTiming = {
    naturalSizeMs: Math.round(naturalSizeMs),
    renderMs: raster.timing.renderMs,
    downscaleMs: raster.timing.downscaleMs,
    encodeMs: Math.round(encodeMs),
    totalMs: Math.round(nowMs() - totalStart),
    svgRasterizerPath: raster.rasterizerPath,
    ...(raster.effectiveDpr != null ? { svgEffectiveDpr: raster.effectiveDpr } : {}),
  };

  return {
    blob: new Blob([bytes], { type: mimeType }),
    label: `${format}${pathSuffix}`,
    timing,
  };
}

async function readSvgNaturalSize(svgText: string): Promise<{ width: number; height: number }> {
  await ensureResvg();
  const meta = new Resvg(svgText);
  try {
    if (meta.width > 0 && meta.height > 0) {
      return { width: meta.width, height: meta.height };
    }
  } finally {
    meta.free();
  }
  throw new Error('SVG rasterization failed: could not resolve intrinsic dimensions');
}

async function buildSvgRaster(
  svgText: string,
  logicalW: number,
  logicalH: number,
  pipeline: SvgPipelineOptions
): Promise<SvgRasterizeResult> {
  if (pipeline.svgExportDensity === 'legacy') {
    return rasterizeLegacyPipeline(svgText, logicalW, logicalH);
  }

  const effectiveDpr = computeEffectiveDisplayDpr(logicalW, logicalH, pipeline.svgDisplayDpr);
  const physW = Math.max(1, Math.round(logicalW * effectiveDpr));
  const physH = Math.max(1, Math.round(logicalH * effectiveDpr));
  checkPixelLimit(physW, physH);

  const mode = pipeline.svgRasterizer;
  const tryBrowser = mode === 'auto' || mode === 'browser';

  if (tryBrowser) {
    try {
      const renderStart = nowMs();
      const imageData = await rasterizeSvgWithBrowser(svgText, logicalW, logicalH, physW, physH);
      const renderMs = Math.round(nowMs() - renderStart);
      return {
        imageData,
        timing: { renderMs, downscaleMs: 0 },
        rasterizerPath: 'browser',
        bitmapWidth: physW,
        bitmapHeight: physH,
        effectiveDpr,
      };
    } catch (e) {
      if (mode === 'browser') {
        const msg = e instanceof BrowserSvgRasterError ? e.message : String(e);
        throw new Error(`SVG browser rasterization failed: ${msg}`);
      }
    }
  }

  const renderStart = nowMs();
  const internal = await rasterizeWithResvg(svgText, physW);
  const renderMs = Math.round(nowMs() - renderStart);
  if (internal.width !== physW) {
    throw new Error(
      `SVG dimension invariant failed at internal-render-display: expected width ${physW}, got ${internal.width}`
    );
  }

  return {
    imageData: internal,
    timing: { renderMs, downscaleMs: 0 },
    rasterizerPath: 'resvg',
    bitmapWidth: internal.width,
    bitmapHeight: internal.height,
    effectiveDpr,
  };
}

async function rasterizeLegacyPipeline(
  svgText: string,
  width: number,
  height: number
): Promise<SvgRasterizeResult> {
  const { renderWidth, renderHeight } = computeInternalRenderSize(width, height);

  const renderStart = nowMs();
  const internal = await rasterizeWithResvg(svgText, renderWidth);
  const renderMs = Math.round(nowMs() - renderStart);
  assertDimensions(internal.width, internal.height, renderWidth, renderHeight, 'internal-render');

  const downscaleStart = nowMs();
  const finalImage = await downscaleImageData(internal, width, height);
  const downscaleMs = Math.round(nowMs() - downscaleStart);

  return {
    imageData: finalImage,
    timing: { renderMs, downscaleMs },
    rasterizerPath: 'resvg',
    bitmapWidth: width,
    bitmapHeight: height,
  };
}

async function rasterizeWithResvg(svgText: string, renderWidth: number): Promise<ImageData> {
  await ensureResvg();
  const resvg = new Resvg(svgText, {
    fitTo: { mode: 'width', value: renderWidth },
  });
  const rendered = resvg.render();
  try {
    checkPixelLimit(rendered.width, rendered.height);
    const rgba = new Uint8ClampedArray(rendered.pixels);
    return new ImageData(rgba, rendered.width, rendered.height);
  } finally {
    rendered.free();
    resvg.free();
  }
}

export function computeInternalRenderSize(
  width: number,
  height: number
): { renderWidth: number; renderHeight: number } {
  const baseWidth = Math.max(1, Math.round(width));
  const baseHeight = Math.max(1, Math.round(height));
  let scale = SVG_INTERNAL_SSAA_SCALE;
  const projectedPixels = baseWidth * baseHeight * scale * scale;
  if (projectedPixels > MAX_PIXELS) {
    scale = Math.max(1, Math.sqrt(MAX_PIXELS / Math.max(baseWidth * baseHeight, 1)));
  }
  const renderWidth = Math.max(baseWidth, Math.round(baseWidth * scale));
  const renderHeight = Math.max(baseHeight, Math.round(baseHeight * scale));
  checkPixelLimit(renderWidth, renderHeight);
  return { renderWidth, renderHeight };
}

/** 
 * Phase 4: Native GPU-accelerated image downscaling replacing pica
 */
async function downscaleImageData(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number
): Promise<ImageData> {
  if (imageData.width === targetWidth && imageData.height === targetHeight) {
    return imageData;
  }
  checkPixelLimit(targetWidth, targetHeight);

  // Use hardware-accelerated createImageBitmap to resize instantly on GPU
  const bitmap = await createImageBitmap(imageData, {
    resizeWidth: targetWidth,
    resizeHeight: targetHeight,
    resizeQuality: 'high'
  });

  const targetCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!targetCtx) throw new Error('Could not get target 2d context');
  
  targetCtx.drawImage(bitmap, 0, 0);
  bitmap.close();
  
  return targetCtx.getImageData(0, 0, targetWidth, targetHeight);
}

function assertDimensions(
  actualWidth: number,
  actualHeight: number,
  expectedWidth: number,
  expectedHeight: number,
  stage: string
): void {
  if (actualWidth !== expectedWidth || actualHeight !== expectedHeight) {
    throw new Error(
      `SVG dimension invariant failed at ${stage}: expected ${expectedWidth}x${expectedHeight}, got ${actualWidth}x${actualHeight}`
    );
  }
}

async function assertEncodedDimensions(
  bytes: ArrayBuffer,
  mimeType: string,
  expectedWidth: number,
  expectedHeight: number
): Promise<void> {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }));
  try {
    assertDimensions(bitmap.width, bitmap.height, expectedWidth, expectedHeight, 'post-encode');
  } finally {
    bitmap.close();
  }
}

function mimeByFormat(format: SvgInternalFormat): string {
  return `image/${format === 'jpeg' ? 'jpeg' : format}`;
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}
