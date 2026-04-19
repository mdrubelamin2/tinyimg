import * as jpeg from '@jsquash/jpeg';
import type { RasterEncodePreset } from './types.ts';
import { compositeImageDataOnWhite } from './composite.ts';
import { hasTransparency } from './alpha.ts';

export async function encodeJpegWithPreset(
  imageData: ImageData,
  pTry: RasterEncodePreset
): Promise<ArrayBuffer> {
  const jpegInput = hasTransparency(imageData.data)
    ? compositeImageDataOnWhite(imageData)
    : imageData;
  return jpeg.encode(jpegInput, {
    quality: pTry.jpeg.quality,
    progressive: pTry.jpeg.progressive,
    trellis_multipass: pTry.jpeg.trellis_multipass,
    trellis_opt_zero: pTry.jpeg.trellis_opt_zero,
    trellis_opt_table: pTry.jpeg.trellis_opt_table,
    trellis_loops: pTry.jpeg.trellis_loops,
    chroma_subsample: pTry.jpeg.chroma_subsample,
    ...(pTry.jpeg.separate_chroma_quality != null
      ? { separate_chroma_quality: pTry.jpeg.separate_chroma_quality }
      : {}),
    ...(pTry.jpeg.chroma_quality != null ? { chroma_quality: pTry.jpeg.chroma_quality } : {}),
  });
}
