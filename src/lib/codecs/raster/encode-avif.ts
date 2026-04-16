import * as avif from '@jsquash/avif';
import type { RasterEncodePreset } from './types.ts';

export function encodeAvifWithPreset(imageData: ImageData, pTry: RasterEncodePreset): Promise<ArrayBuffer> {
  return avif.encode(imageData, { ...pTry.avif });
}
