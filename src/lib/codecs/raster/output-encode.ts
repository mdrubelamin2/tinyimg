/**
 * Policy for flat raster outputs: bitmap and SVG→raster use the same lossless mode + resize slot rules.
 */

import type { LosslessEncoding } from '@/constants'
import type { TaskResizePreset } from '@/lib/queue/types'
import type { ContentPreset } from '@/workers/classify'

import type { AllRasterFormat, EncodeResult, RasterEncodePreset } from './types.ts'

import {
  applyScaleBoostToPreset,
  computeDownscaleRatio,
  qualityBoostFromRatio,
} from './adaptive-quality.ts'
import { encodeRasterWithFallback } from './encode-fallback.ts'
import { encodeRasterWithPreset } from './encode-with-preset.ts'
import { encodeLossless } from './lossless.ts'
import { SVG_DISPLAY_VECTOR_PRESET } from './presets.ts'

export async function encodeBitmapRasterForOutput(
  imageData: ImageData,
  effectiveFormat: string,
  params: {
    boostedByContent?: Partial<Record<ContentPreset, RasterEncodePreset>>
    losslessEncoding: LosslessEncoding
    preset: ContentPreset
    resizePreset: TaskResizePreset
  },
): Promise<EncodeResult> {
  const fmt = (effectiveFormat === 'svg' ? 'webp' : effectiveFormat) as AllRasterFormat
  if (shouldUseLosslessRasterEncode(params.losslessEncoding, params.resizePreset)) {
    return encodeLossless(imageData, fmt)
  }
  return encodeRasterWithFallback(
    imageData,
    effectiveFormat,
    params.preset,
    params.boostedByContent,
  )
}

export async function encodeSvgRasterForOutput(
  imageData: ImageData,
  format: AllRasterFormat,
  params: {
    losslessEncoding: LosslessEncoding
    resizePreset: TaskResizePreset
    srcH: number
    srcW: number
  },
): Promise<EncodeResult> {
  if (shouldUseLosslessRasterEncode(params.losslessEncoding, params.resizePreset)) {
    return encodeLossless(imageData, format)
  }
  const downscaleRatio = computeDownscaleRatio(
    params.srcW,
    params.srcH,
    imageData.width,
    imageData.height,
  )
  const boost = qualityBoostFromRatio(downscaleRatio)
  const lossyPreset =
    boost > 0
      ? applyScaleBoostToPreset(SVG_DISPLAY_VECTOR_PRESET, format, boost, 'graphic')
      : undefined
  const data = await encodeRasterWithPreset(
    imageData,
    format,
    lossyPreset ?? SVG_DISPLAY_VECTOR_PRESET,
    true,
  )
  return { ...data, lossless: false }
}

export function shouldUseLosslessRasterEncode(
  mode: LosslessEncoding,
  resizePreset: TaskResizePreset,
): boolean {
  if (mode === 'none') return false
  if (mode === 'all') return true
  return resizePreset.kind === 'target'
}
