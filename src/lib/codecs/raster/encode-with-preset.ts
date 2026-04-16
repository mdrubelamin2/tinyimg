import * as webp from '@jsquash/webp';
import { isSmallAndTransparent } from '@/workers/classify';
import type { RasterEncodePreset } from './types.ts';
import { encodeAvifWithPreset } from './encode-avif.ts';
import { encodeWebpWithPreset } from './encode-webp.ts';
import { encodeJpegWithPreset } from './encode-jpeg.ts';
import { encodePngWithPreset } from './encode-png.ts';

export async function encodeRasterWithPreset(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png',
  pTry: RasterEncodePreset,
  disableSmallTransparentWebpFallback: boolean
): Promise<ArrayBuffer> {
  const smallTransparent = isSmallAndTransparent(imageData.width, imageData.height, imageData.data);

  switch (format) {
    case 'avif':
      return encodeAvifWithPreset(imageData, pTry);
    case 'webp':
      return encodeWebpWithPreset(
        imageData,
        pTry,
        smallTransparent,
        disableSmallTransparentWebpFallback
      );
    case 'jpeg':
      return encodeJpegWithPreset(imageData, pTry);
    case 'png':
      return encodePngWithPreset(imageData, pTry, smallTransparent);
    default:
      return webp.encode(imageData, {
        quality: pTry.webp.quality,
        method: pTry.webp.method,
        use_sharp_yuv: pTry.webp.use_sharp_yuv,
      });
  }
}
