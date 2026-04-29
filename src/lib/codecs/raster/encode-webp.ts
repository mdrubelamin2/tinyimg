import { encode } from '@jsquash/webp'

import type { EncodeResult, RasterEncodePreset } from './types.ts'

import { WEBP_QUALITY_TRANSPARENT } from './presets.ts'

export async function encodeWebpLossless(imageData: ImageData): Promise<EncodeResult> {
  const data = await encode(imageData, {
    exact: 1,
    lossless: 1,
    method: 4,
    quality: 75,
  })
  return { data, lossless: true }
}

export async function encodeWebpWithPreset(
  imageData: ImageData,
  pTry: RasterEncodePreset,
  smallTransparent: boolean,
  disableSmallTransparentWebpFallback: boolean,
): Promise<EncodeResult> {
  const webpQuality =
    smallTransparent && !disableSmallTransparentWebpFallback
      ? WEBP_QUALITY_TRANSPARENT
      : pTry.webp.quality
  const data = await encode(imageData, {
    method: pTry.webp.method,
    quality: webpQuality,
    use_sharp_yuv: pTry.webp.use_sharp_yuv,
    ...(pTry.webp.sns_strength == null ? {} : { sns_strength: pTry.webp.sns_strength }),
    ...(pTry.webp.filter_strength == null ? {} : { filter_strength: pTry.webp.filter_strength }),
    ...(pTry.webp.filter_sharpness == null ? {} : { filter_sharpness: pTry.webp.filter_sharpness }),
    ...(pTry.webp.autofilter == null ? {} : { autofilter: pTry.webp.autofilter }),
    ...(pTry.webp.exact == null ? {} : { exact: pTry.webp.exact }),
    ...(pTry.webp.near_lossless == null ? {} : { near_lossless: pTry.webp.near_lossless }),
    ...(pTry.webp.alpha_quality == null ? {} : { alpha_quality: pTry.webp.alpha_quality }),
  })
  return { data, lossless: false }
}
