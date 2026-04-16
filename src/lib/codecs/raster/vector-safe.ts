import { LOSSLESS_SIZE_GUARD_RATIO } from '@/constants';
import type { RasterEncodePreset } from './types.ts';
import { SVG_DISPLAY_VECTOR_PRESET, SVG_VECTOR_SAFE_PRESET } from './presets.ts';
import { encodeLossless } from './lossless.ts';
import { encodeRasterWithPreset } from './encode-with-preset.ts';

export async function encodeRasterVectorSafe(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png'
): Promise<ArrayBuffer> {
  return encodeRasterWithPreset(imageData, format, SVG_VECTOR_SAFE_PRESET, true);
}

export async function encodeRasterVectorSafeWithSizeSafeguard(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png',
  options?: { displayQuality?: boolean }
): Promise<ArrayBuffer> {
  const vectorPreset = options?.displayQuality
    ? (SVG_DISPLAY_VECTOR_PRESET as unknown as RasterEncodePreset)
    : SVG_VECTOR_SAFE_PRESET;
  const losslessBytes = await encodeLossless(imageData, format);
  const lossyBytes = await encodeRasterWithPreset(imageData, format, vectorPreset, true);

  if (losslessBytes.byteLength <= lossyBytes.byteLength * LOSSLESS_SIZE_GUARD_RATIO) {
    return losslessBytes;
  }

  return lossyBytes;
}
