import * as avif from '@jsquash/avif';
import type { RasterEncodePreset, EncodeResult } from './types.ts';

export async function encodeAvifLossless(imageData: ImageData): Promise<EncodeResult> {
  const data = await avif.encode(imageData, { lossless: true });
  return { data, lossless: true };
}

export async function encodeAvifWithPreset(imageData: ImageData, pTry: RasterEncodePreset): Promise<EncodeResult> {
  const data = await avif.encode(imageData, { ...pTry.avif });
  return { data, lossless: false };
}
