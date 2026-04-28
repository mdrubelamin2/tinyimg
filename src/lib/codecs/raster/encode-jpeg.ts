import { encode } from '@jsquash/jpeg'

import type { EncodeResult, RasterEncodePreset } from './types.ts'

import { hasTransparency } from './alpha.ts'
import { compositeImageDataOnWhite } from './composite.ts'

export async function encodeJpegLossless(imageData: ImageData): Promise<EncodeResult> {
  const jpegInput = hasTransparency(imageData.data)
    ? compositeImageDataOnWhite(imageData)
    : imageData
  const data = await encode(jpegInput, {
    chroma_subsample: 0,
    progressive: true,
    quality: 100,
    trellis_loops: 1,
    trellis_multipass: true,
    trellis_opt_table: true,
    trellis_opt_zero: true,
  })
  return { data, lossless: true }
}

export async function encodeJpegWithPreset(
  imageData: ImageData,
  pTry: RasterEncodePreset,
): Promise<EncodeResult> {
  const jpegInput = hasTransparency(imageData.data)
    ? compositeImageDataOnWhite(imageData)
    : imageData
  const data = await encode(jpegInput, {
    chroma_subsample: pTry.jpeg.chroma_subsample,
    progressive: pTry.jpeg.progressive,
    quality: pTry.jpeg.quality,
    trellis_loops: pTry.jpeg.trellis_loops,
    trellis_multipass: pTry.jpeg.trellis_multipass,
    trellis_opt_table: pTry.jpeg.trellis_opt_table,
    trellis_opt_zero: pTry.jpeg.trellis_opt_zero,
    ...(pTry.jpeg.separate_chroma_quality == null
      ? {}
      : { separate_chroma_quality: pTry.jpeg.separate_chroma_quality }),
    ...(pTry.jpeg.chroma_quality == null ? {} : { chroma_quality: pTry.jpeg.chroma_quality }),
  })
  return { data, lossless: false }
}
