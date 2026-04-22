import type { ContentPreset } from '@/workers/classify';
import { isSmallAndTransparent } from '@/workers/classify';
import type { RasterEncodePreset, EncodeResult } from './types.ts';
import { encodeAvifWithPreset } from './encode-avif.ts';
import { encodeWebpWithPreset } from './encode-webp.ts';
import { encodeJpegWithPreset } from './encode-jpeg.ts';
import { encodePngWithPreset } from './encode-png.ts';

export async function encodeRasterWithPreset(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png',
  pTry: RasterEncodePreset,
  disableSmallTransparentWebpFallback: boolean,
  contentPreset?: ContentPreset
): Promise<EncodeResult> {
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
      return encodePngWithPreset(imageData, pTry, smallTransparent, contentPreset);
    default:
      return encodeWebpWithPreset(
        imageData,
        pTry,
        smallTransparent,
        disableSmallTransparentWebpFallback
      );
  }
}
