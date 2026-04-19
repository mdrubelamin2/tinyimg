import * as webp from '@jsquash/webp';
import type { RasterEncodePreset } from './types.ts';
import { WEBP_QUALITY_TRANSPARENT } from './presets.ts';

export function encodeWebpWithPreset(
  imageData: ImageData,
  pTry: RasterEncodePreset,
  smallTransparent: boolean,
  disableSmallTransparentWebpFallback: boolean
): Promise<ArrayBuffer> {
  const webpQuality =
    smallTransparent && !disableSmallTransparentWebpFallback
      ? WEBP_QUALITY_TRANSPARENT
      : pTry.webp.quality;
  return webp.encode(imageData, {
    quality: webpQuality,
    method: pTry.webp.method,
    use_sharp_yuv: pTry.webp.use_sharp_yuv,
    ...(pTry.webp.sns_strength != null ? { sns_strength: pTry.webp.sns_strength } : {}),
    ...(pTry.webp.filter_strength != null ? { filter_strength: pTry.webp.filter_strength } : {}),
    ...(pTry.webp.filter_sharpness != null ? { filter_sharpness: pTry.webp.filter_sharpness } : {}),
    ...(pTry.webp.autofilter != null ? { autofilter: pTry.webp.autofilter } : {}),
    ...(pTry.webp.exact != null ? { exact: pTry.webp.exact } : {}),
    ...(pTry.webp.near_lossless != null ? { near_lossless: pTry.webp.near_lossless } : {}),
    ...(pTry.webp.alpha_quality != null ? { alpha_quality: pTry.webp.alpha_quality } : {}),
  });
}
