import type { ContentPreset } from '@/workers/classify';
import { PRESETS } from './presets.ts';
import { encodeRasterWithPreset } from './encode-with-preset.ts';
import { toErrorMessage } from './io.ts';

export async function encodeRaster(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png',
  preset: ContentPreset
): Promise<ArrayBuffer> {
  const pTry = PRESETS[preset];
  return encodeRasterWithPreset(imageData, format, pTry, false);
}

/** Encode with fallback: try graphic preset, then photo if needed. */
export async function encodeRasterWithFallback(
  imageData: ImageData,
  effectiveFormat: string,
  preset: ContentPreset
): Promise<ArrayBuffer> {
  const maxAttempts = preset === 'graphic' ? 2 : 1;
  const format = (effectiveFormat === 'svg' ? 'webp' : effectiveFormat) as 'avif' | 'webp' | 'jpeg' | 'png';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await encodeRaster(imageData, format, attempt === 0 ? preset : 'photo');
    } catch (err) {
      if (attempt < maxAttempts - 1) continue;
      throw new Error(
        `${effectiveFormat.toUpperCase()} encode failed: ${toErrorMessage(err, 'encoding error')}`
      );
    }
  }
  throw new Error('Encode failed');
}
