import * as webp from '@jsquash/webp';
import * as avif from '@jsquash/avif';
import * as jpeg from '@jsquash/jpeg';
import * as png from '@jsquash/oxipng';
import { compositeImageDataOnWhite } from './composite.ts';
import { hasTransparency } from './alpha.ts';

async function imageDataToRawPng(imageData: ImageData): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context for lossless PNG');
  ctx.putImageData(imageData, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return blob.arrayBuffer();
}

export async function encodeLossless(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png'
): Promise<ArrayBuffer> {
  switch (format) {
    case 'webp':
      return webp.encode(imageData, {
        lossless: 1,
        quality: 75,
        method: 4,
        exact: 1,
      });
    case 'avif':
      return avif.encode(imageData, { lossless: true });
    case 'png': {
      const rawPng = await imageDataToRawPng(imageData);
      return png.optimise(rawPng, { level: 3, interlace: false, optimiseAlpha: true });
    }
    case 'jpeg': {
      const jpegInput = hasTransparency(imageData.data)
        ? await compositeImageDataOnWhite(imageData)
        : imageData;
      return jpeg.encode(jpegInput, {
        quality: 100,
        progressive: true,
        trellis_multipass: true,
        trellis_opt_zero: true,
        trellis_opt_table: true,
        trellis_loops: 1,
        chroma_subsample: 0,
      });
    }
    default:
      return webp.encode(imageData, { lossless: 1, quality: 75, method: 4, exact: 1 });
  }
}
