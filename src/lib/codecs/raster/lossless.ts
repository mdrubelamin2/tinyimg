import { encodeWebpLossless } from './encode-webp.ts';
import { encodeAvifLossless } from './encode-avif.ts';
import { encodePngLossless } from './encode-png.ts';
import { encodeJpegLossless } from './encode-jpeg.ts';
import type { EncodeResult } from './types.ts';

export async function encodeLossless(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png'
): Promise<EncodeResult> {
  switch (format) {
    case 'webp':
      return encodeWebpLossless(imageData);
    case 'avif':
      return encodeAvifLossless(imageData);
    case 'png':
      return encodePngLossless(imageData);
    case 'jpeg':
      return encodeJpegLossless(imageData);
    default:
      return encodeWebpLossless(imageData);
  }
}
