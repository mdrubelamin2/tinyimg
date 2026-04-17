import type { ContentPreset } from '@/workers/classify';
import { PRESETS } from './presets.ts';
import type { RasterEncodePreset } from './types.ts';
import { encodeRasterWithPreset } from './encode-with-preset.ts';
import { toErrorMessage } from './io.ts';

export async function encodeRaster(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png',
  preset: ContentPreset,
  rasterOverride?: RasterEncodePreset
): Promise<ArrayBuffer> {
  const pTry = rasterOverride ?? PRESETS[preset];
  return encodeRasterWithPreset(imageData, format, pTry, false, preset);
}

/** Encode with fallback: try graphic preset, then photo if needed. */
export async function encodeRasterWithFallback(
  imageData: ImageData,
  effectiveFormat: string,
  preset: ContentPreset,
  boostedByContent?: Partial<Record<ContentPreset, RasterEncodePreset>>
): Promise<ArrayBuffer> {
  const maxAttempts = preset === 'graphic' ? 2 : 1;
  const format = (effectiveFormat === 'svg' ? 'webp' : effectiveFormat) as 'avif' | 'webp' | 'jpeg' | 'png';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const p = attempt === 0 ? preset : 'photo';
      const override = boostedByContent?.[p];
      return await encodeRaster(imageData, format, p, override);
    } catch (err) {
      if (attempt < maxAttempts - 1) continue;
      throw new Error(
        `${effectiveFormat.toUpperCase()} encode failed: ${toErrorMessage(err, 'encoding error')}`
      );
    }
  }
  throw new Error('Encode failed');
}
