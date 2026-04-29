/**
 * SVG pipeline: SVGO optimize, rasterize (browser-first or resvg), display-density or legacy pixel-lock, encode/wrap.
 */

import { Resvg } from '@resvg/resvg-wasm'

import type { LosslessEncoding, SvgInternalFormat } from '@/constants'
import type { RasterFormat } from '@/lib/codecs/raster/types'
import type { TaskResizePreset } from '@/lib/queue/types'

import {
  MAX_PIXELS,
  SVG_INTERNAL_SSAA_SCALE,
  SVG_NODES_ANCHOR_MAX,
  SVG_NODES_MAX,
  SVG_RASTER_BYTES_MAX,
  SVG_RASTER_BYTES_MIN_FOR_HYBRID,
  SVG_RASTER_DOMINANCE_RATIO,
  SVG_SEGMENTS_MAX,
  SVG_TINY_FILE_BYTES_MAX,
} from '@/constants'
import { encodeLossless } from '@/lib/codecs/raster/lossless'
import { encodeSvgRasterForOutput } from '@/lib/codecs/raster/output-encode'
import { optimizeSvg } from '@/lib/optimizer/svg-optimizer'

import { ensureResvg } from './optimizer-wasm'
import { checkPixelLimit, toBase64 } from './raster-encode'

const SVG_NS = 'http://www.w3.org/2000/svg'
const SVG_DISPLAY_DPR_MIN = 1
const SVG_DISPLAY_DPR_MAX = 3
export interface SvgPipelineOptions {
  svgDisplayDpr: number
  svgInternalFormat: SvgInternalFormat
}

export interface SvgStageTiming {
  classifyMs?: number | undefined
  downscaleMs?: number | undefined
  encodeMs?: number | undefined
  naturalSizeMs?: number | undefined
  renderMs?: number | undefined
  /** Effective DPR used when svgExportDensity is display (may be lowered vs requested for MAX_PIXELS). */
  svgEffectiveDpr?: number | undefined
  svgoMs?: number | undefined
  svgRasterizerPath?: 'browser' | 'resvg' | undefined
  totalMs?: number | undefined
}

interface SvgRasterizeResult {
  bitmapHeight: number
  bitmapWidth: number
  effectiveDpr?: number
  imageData: ImageData
  naturalHeight?: number
  naturalWidth?: number
}

const RASTER_FORMATS = ['webp', 'avif', 'jpeg', 'png', 'heic', 'heif'] as const
export type SvgRasterFormat = (typeof RASTER_FORMATS)[number]

interface RasterizeResult {
  imageData: ImageData
  naturalHeight: number
  naturalWidth: number
}

export async function assertEncodedDimensions(
  bytes: ArrayBuffer,
  mimeType: string,
  expectedWidth: number,
  expectedHeight: number,
): Promise<void> {
  if (mimeType.includes('heic') || mimeType.includes('heif')) {
    return
  }
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }))
  try {
    assertDimensions(bitmap.width, bitmap.height, expectedWidth, expectedHeight, 'post-encode')
  } finally {
    bitmap.close()
  }
}

/**
 * Effective scale for display-density raster: requested DPR clamped 1..3, reduced when
 * pixel count would exceed MAX_PIXELS, or a uniform factor <1 when 1:1 is still over budget.
 */
export function computeEffectiveDisplayDpr(
  logicalW: number,
  logicalH: number,
  requestedDpr: number,
): number {
  let dpr = Math.round(Number(requestedDpr))
  if (!Number.isFinite(dpr) || dpr < SVG_DISPLAY_DPR_MIN) {
    dpr = SVG_DISPLAY_DPR_MIN
  }
  if (dpr > SVG_DISPLAY_DPR_MAX) {
    dpr = SVG_DISPLAY_DPR_MAX
  }
  const bw = Math.max(1, Math.round(logicalW))
  const bh = Math.max(1, Math.round(logicalH))
  while (dpr >= SVG_DISPLAY_DPR_MIN) {
    const pw = Math.max(1, Math.round(bw * dpr))
    const ph = Math.max(1, Math.round(bh * dpr))
    if (pw * ph <= MAX_PIXELS) break
    dpr -= 1
  }
  if (dpr < SVG_DISPLAY_DPR_MIN) {
    // Integer DPRs 1..3 cannot fit; use uniform scale so phys pixels stay within MAX_PIXELS
    return Math.sqrt(MAX_PIXELS / (bw * bh))
  }
  return dpr
}

export function computeInternalRenderSize(
  width: number,
  height: number,
): { renderHeight: number; renderWidth: number } {
  const baseWidth = Math.max(1, Math.round(width))
  const baseHeight = Math.max(1, Math.round(height))
  let scale = SVG_INTERNAL_SSAA_SCALE
  const projectedPixels = baseWidth * baseHeight * scale * scale
  if (projectedPixels > MAX_PIXELS) {
    scale = Math.max(1, Math.sqrt(MAX_PIXELS / Math.max(baseWidth * baseHeight, 1)))
  }
  const renderWidth = Math.max(baseWidth, Math.round(baseWidth * scale))
  const renderHeight = Math.max(baseHeight, Math.round(baseHeight * scale))
  checkPixelLimit(renderWidth, renderHeight)
  return { renderHeight, renderWidth }
}

export function isSvgRasterFormat(f: string): f is SvgRasterFormat {
  return RASTER_FORMATS.includes(f as SvgRasterFormat)
}

/**
 * ### Hierarchical Expert Pipeline
 *
 * To ensure optimal performance and visual fidelity, this pipeline employs a hierarchical strategy
 * that chooses between raw vector output and raster-wrapped SVG based on content complexity.
 *
 * #### 1. The Circuit Breaker (isTiny)
 * - Files under 4KB are never wrapped. The overhead of rasterization and Base64 encoding
 *   outweighs any potential rendering benefits at this scale.
 *
 * #### 2. Expert Complexity Heuristics
 * - **Vector Complexity**: Extremely complex vectors (>1500 nodes or >5000 segments)
 *   cause significant "browser jank" during layout and paint.
 * - **Heavy Hybrid**: Large embedded rasters (>32KB) are wrapped to leverage
 *   specialized image decoders (WebP/AVIF).
 * - **Hybrid Dominant**: If embedded rasters exceed 50% of total size and are >4KB,
 *   the file is treated as a hybrid and wrapped.
 * - **Complexity Anchor**: If the SVG contains any raster data and has >256 nodes,
 *   it is wrapped to ensure smooth mobile performance.
 */
export async function processSvg(
  buffer: ArrayBuffer,
  options: SvgPipelineOptions,
): Promise<{ blob: Blob; label: string }> {
  const text = new TextDecoder().decode(buffer)

  const { data: optimizedSvg, metadata } = await optimizeSvg(text)
  const totalSizeBytes = new TextEncoder().encode(optimizedSvg).length

  const isTiny = totalSizeBytes < SVG_TINY_FILE_BYTES_MAX
  const isVectorComplex =
    metadata.nodeCount > SVG_NODES_MAX || metadata.segmentCount > SVG_SEGMENTS_MAX
  const isHeavyHybrid = metadata.rasterBytes > SVG_RASTER_BYTES_MAX
  const isHybridDominant =
    metadata.rasterBytes > SVG_RASTER_BYTES_MIN_FOR_HYBRID &&
    metadata.rasterBytes / Math.max(1, totalSizeBytes) > SVG_RASTER_DOMINANCE_RATIO
  const isComplexityAnchor = metadata.rasterBytes > 0 && metadata.nodeCount > SVG_NODES_ANCHOR_MAX

  const shouldWrap =
    !isTiny && (isVectorComplex || isHeavyHybrid || isHybridDominant || isComplexityAnchor)

  if (!shouldWrap) {
    return {
      blob: new Blob([optimizedSvg], { type: 'image/svg+xml' }),
      label: 'svg (optimized)',
    }
  }

  const raster = await buildSvgRaster(optimizedSvg, 0, 0, options)
  const width = raster.naturalWidth!
  const height = raster.naturalHeight!

  assertDimensions(
    raster.imageData.width,
    raster.imageData.height,
    raster.bitmapWidth,
    raster.bitmapHeight,
    'post-raster',
  )

  const { svgInternalFormat } = options
  const internalFormat = svgInternalFormat ?? 'webp'
  const mimeType = mimeByFormat(internalFormat)
  // JXL is not yet supported in SVG internal encode — fall back to webp
  const encodeFormat = isSvgRasterFormat(internalFormat) ? internalFormat : ('webp' as const)
  const { data: internalBytes } = await encodeLossless(raster.imageData, encodeFormat)
  await assertEncodedDimensions(internalBytes, mimeType, raster.bitmapWidth, raster.bitmapHeight)

  const internalBase64 = await toBase64(internalBytes)
  const svgWrapper = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="${SVG_NS}">
  <image href="data:${mimeType};base64,${internalBase64}" width="${width}" height="${height}" />
</svg>`

  return {
    blob: new Blob([svgWrapper], { type: 'image/svg+xml' }),
    label: `svg (${internalFormat})`,
  }
}

/**
 * Rasterize SVG file to raw `ImageData` (before format encode). Used when output size may differ from rasterized pixels.
 */
export async function rasterizeSvgFileToImageData(
  buffer: ArrayBuffer,
  options: SvgPipelineOptions,
): Promise<{
  bitmapHeight: number
  bitmapWidth: number
  imageData: ImageData
}> {
  const text = new TextDecoder().decode(buffer)

  const raster = await buildSvgRaster(text, 0, 0, options)
  assertDimensions(
    raster.imageData.width,
    raster.imageData.height,
    raster.bitmapWidth,
    raster.bitmapHeight,
    'post-raster',
  )

  return {
    bitmapHeight: raster.bitmapHeight,
    bitmapWidth: raster.bitmapWidth,
    imageData: raster.imageData,
  }
}

/**
 * Rasterize SVG to requested flat raster format (webp/avif/png/jpeg).
 */
export async function rasterizeSvgToFormat(
  buffer: ArrayBuffer,
  options: SvgPipelineOptions & { format: SvgRasterFormat } & {
    losslessEncoding?: LosslessEncoding
    resizePreset?: TaskResizePreset
  },
): Promise<{ blob: Blob; label: string }> {
  const { bitmapHeight, bitmapWidth, imageData } = await rasterizeSvgFileToImageData(
    buffer,
    options,
  )

  const format = options.format
  const losslessEncoding = options.losslessEncoding ?? 'none'
  const resizePreset = options.resizePreset ?? ({ kind: 'native' } satisfies TaskResizePreset)
  const { data: bytes } = await encodeSvgRasterForOutput(imageData, format as RasterFormat, {
    losslessEncoding,
    resizePreset,
    srcH: imageData.height,
    srcW: imageData.width,
  })
  const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`
  await assertEncodedDimensions(bytes, mimeType, bitmapWidth, bitmapHeight)

  return {
    blob: new Blob([bytes], { type: mimeType }),
    label: `${format}`,
  }
}

function assertDimensions(
  actualWidth: number,
  actualHeight: number,
  expectedWidth: number,
  expectedHeight: number,
  stage: string,
): void {
  if (actualWidth !== expectedWidth || actualHeight !== expectedHeight) {
    throw new Error(
      `SVG dimension invariant failed at ${stage}: expected ${expectedWidth}x${expectedHeight}, got ${actualWidth}x${actualHeight}`,
    )
  }
}

async function buildSvgRaster(
  svgText: string,
  logicalW: number,
  logicalH: number,
  pipeline: SvgPipelineOptions,
): Promise<SvgRasterizeResult> {
  let naturalWidth = logicalW
  let naturalHeight = logicalH

  await ensureResvg()
  const meta = new Resvg(svgText)
  try {
    if (naturalWidth <= 0) naturalWidth = meta.width
    if (naturalHeight <= 0) naturalHeight = meta.height
  } finally {
    meta.free()
  }

  if (naturalWidth <= 0 || naturalHeight <= 0) {
    throw new Error('SVG rasterization failed: could not resolve intrinsic dimensions')
  }

  const effectiveDpr = computeEffectiveDisplayDpr(
    naturalWidth,
    naturalHeight,
    pipeline.svgDisplayDpr,
  )
  const physW = Math.max(1, Math.round(naturalWidth * effectiveDpr))
  const physH = Math.max(1, Math.round(naturalHeight * effectiveDpr))
  checkPixelLimit(physW, physH)

  const { imageData } = await rasterizeWithResvg(svgText, physW)
  if (imageData.width !== physW) {
    throw new Error(
      `SVG dimension invariant failed at internal-render-display: expected width ${physW}, got ${imageData.width}`,
    )
  }

  return {
    bitmapHeight: imageData.height,
    bitmapWidth: imageData.width,
    effectiveDpr,
    imageData,
    naturalHeight,
    naturalWidth,
  }
}

function mimeByFormat(format: SvgInternalFormat): string {
  return `image/${format === 'jpeg' ? 'jpeg' : format}`
}

async function rasterizeWithResvg(svgText: string, renderWidth: number): Promise<RasterizeResult> {
  await ensureResvg()
  const resvg = new Resvg(svgText, {
    fitTo: { mode: 'width', value: renderWidth },
  })
  const naturalWidth = resvg.width
  const naturalHeight = resvg.height
  const rendered = resvg.render()
  try {
    checkPixelLimit(rendered.width, rendered.height)
    const rgba = new Uint8ClampedArray(rendered.pixels)
    const imageData = new ImageData(rgba, rendered.width, rendered.height)
    return { imageData, naturalHeight, naturalWidth }
  } finally {
    rendered.free()
    resvg.free()
  }
}
