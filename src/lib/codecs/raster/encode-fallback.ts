import type { ContentPreset } from '@/workers/classify'

import type { AllRasterFormat, EncodeResult, RasterEncodePreset } from './types'

import { encodeRasterWithPreset } from './encode-with-preset'
import { toErrorMessage } from './io'
import { PRESETS } from './presets'

export async function encodeRaster(
  imageData: ImageData,
  format: AllRasterFormat,
  preset: ContentPreset,
  rasterOverride?: RasterEncodePreset,
): Promise<EncodeResult> {
  const pTry = rasterOverride ?? PRESETS[preset]
  return encodeRasterWithPreset(imageData, format, pTry, false, preset)
}

/** Encode with fallback: try graphic preset, then photo if needed. */
export async function encodeRasterWithFallback(
  imageData: ImageData,
  effectiveFormat: string,
  preset: ContentPreset,
  boostedByContent?: Partial<Record<ContentPreset, RasterEncodePreset>>,
): Promise<EncodeResult> {
  const maxAttempts =
    preset === 'graphic' && effectiveFormat !== 'heic' && effectiveFormat !== 'heif' ? 2 : 1
  const format = (effectiveFormat === 'svg' ? 'webp' : effectiveFormat) as AllRasterFormat
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const p = attempt === 0 ? preset : 'photo'
      const override = boostedByContent?.[p]
      return await encodeRaster(imageData, format, p, override)
    } catch (error) {
      if (attempt < maxAttempts - 1) continue
      throw new Error(
        `${effectiveFormat.toUpperCase()} encode failed: ${toErrorMessage(error, 'encoding error')}`,
      )
    }
  }
  throw new Error('Encode failed')
}
