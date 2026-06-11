import type { ContentPreset } from '@/workers/classify'

import { isSmallAndTransparent } from '@/workers/classify'

import type { AllRasterFormat, EncodeResult, RasterEncodePreset } from './types.ts'

export async function encodeRasterWithPreset(
  imageData: ImageData,
  format: AllRasterFormat,
  pTry: RasterEncodePreset,
  disableSmallTransparentWebpFallback: boolean,
  contentPreset?: ContentPreset,
): Promise<EncodeResult> {
  const smallTransparent = isSmallAndTransparent(imageData.width, imageData.height, imageData.data)

  switch (format) {
    case 'avif': {
      const { encodeAvifWithPreset } = await import('./encode-avif.ts')
      return encodeAvifWithPreset(imageData, pTry)
    }
    case 'heic':
    case 'heif': {
      const { encodeHeicWithPreset } = await import('./encode-heic.ts')
      return encodeHeicWithPreset(imageData, pTry)
    }
    case 'jpeg': {
      const { encodeJpegWithPreset } = await import('./encode-jpeg.ts')
      return encodeJpegWithPreset(imageData, pTry)
    }
    case 'png': {
      const { encodePngWithPreset } = await import('./encode-png.ts')
      return encodePngWithPreset(imageData, pTry, smallTransparent, contentPreset)
    }
    case 'webp': {
      const { encodeWebpWithPreset } = await import('./encode-webp.ts')
      return encodeWebpWithPreset(
        imageData,
        pTry,
        smallTransparent,
        disableSmallTransparentWebpFallback,
      )
    }
    default: {
      const { encodeWebpWithPreset } = await import('./encode-webp.ts')
      return encodeWebpWithPreset(
        imageData,
        pTry,
        smallTransparent,
        disableSmallTransparentWebpFallback,
      )
    }
  }
}
