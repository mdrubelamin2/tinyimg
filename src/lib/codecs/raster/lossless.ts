import type { AllRasterFormat, EncodeResult } from './types.ts'

import { encodeAvifLossless } from './encode-avif.ts'
import { encodeHeicLossless } from './encode-heic.ts'
import { encodeJpegLossless } from './encode-jpeg.ts'
import { encodePngLossless } from './encode-png.ts'
import { encodeWebpLossless } from './encode-webp.ts'

export async function encodeLossless(
  imageData: ImageData,
  format: AllRasterFormat,
): Promise<EncodeResult> {
  switch (format) {
    case 'avif': {
      return encodeAvifLossless(imageData)
    }
    case 'heic':
    case 'heif': {
      return encodeHeicLossless(imageData)
    }
    case 'jpeg': {
      return encodeJpegLossless(imageData)
    }
    case 'png': {
      return encodePngLossless(imageData)
    }
    case 'webp': {
      return encodeWebpLossless(imageData)
    }
    default: {
      return encodeWebpLossless(imageData)
    }
  }
}
