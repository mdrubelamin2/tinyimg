import type { AllRasterFormat, EncodeResult } from './types.ts'

export async function encodeLossless(
  imageData: ImageData,
  format: AllRasterFormat,
): Promise<EncodeResult> {
  switch (format) {
    case 'avif': {
      const { encodeAvifLossless } = await import('./encode-avif.ts')
      return encodeAvifLossless(imageData)
    }
    case 'heic':
    case 'heif': {
      const { encodeHeicLossless } = await import('./encode-heic.ts')
      return encodeHeicLossless(imageData)
    }
    case 'jpeg': {
      const { encodeJpegLossless } = await import('./encode-jpeg.ts')
      return encodeJpegLossless(imageData)
    }
    case 'png': {
      const { encodePngLossless } = await import('./encode-png.ts')
      return encodePngLossless(imageData)
    }
    case 'webp': {
      const { encodeWebpLossless } = await import('./encode-webp.ts')
      return encodeWebpLossless(imageData)
    }
    default: {
      const { encodeWebpLossless } = await import('./encode-webp.ts')
      return encodeWebpLossless(imageData)
    }
  }
}
