import * as png from '@jsquash/oxipng';
import { ImageQuantizer, encode_palette_to_png } from 'libimagequant-wasm/wasm/libimagequant_wasm.js';
import { ensureQuant } from '@/workers/optimizer-wasm';
import type { ContentPreset } from '@/workers/classify';
import type { RasterEncodePreset } from './types.ts';
import { PRESETS, PNG_MILD_QUANT_MAX, PNG_MILD_QUANT_MIN } from './presets.ts';
import { toErrorMessage } from './io.ts';
import { encodeLossless } from './lossless.ts';

async function encodePngQuantized(
  imageData: ImageData,
  pTry: RasterEncodePreset,
  qMin: number,
  qMax: number
): Promise<ArrayBuffer> {
  await ensureQuant();
  const q = new ImageQuantizer();
  try {
    q.setQuality(qMin, qMax);
    const res = q.quantizeImage(imageData.data, imageData.width, imageData.height);
    try {
      const qPng = encode_palette_to_png(
        res.getPaletteIndices(imageData.data, imageData.width, imageData.height),
        res.getPalette(),
        imageData.width,
        imageData.height
      );
      return png.optimise(qPng.buffer as ArrayBuffer, {
        level: pTry.png.oxipngLevel,
        interlace: false,
        optimiseAlpha: true,
      });
    } finally {
      res.free();
    }
  } finally {
    q.free();
  }
}

export async function encodePngWithPreset(
  imageData: ImageData,
  pTry: RasterEncodePreset,
  smallTransparent: boolean,
  contentPreset?: ContentPreset
): Promise<ArrayBuffer> {
  const useMildQuant =
    smallTransparent &&
    (contentPreset === 'photo' || (contentPreset === undefined && pTry === PRESETS.photo));
  const qMin = useMildQuant ? PNG_MILD_QUANT_MIN : pTry.png.quantMin;
  const qMax = useMildQuant ? PNG_MILD_QUANT_MAX : pTry.png.quantMax;

  try {
    return await encodePngQuantized(imageData, pTry, qMin, qMax);
  } catch (err) {
    const msg = toErrorMessage(err, '');
    if (msg.includes('QualityTooLow')) {
      try {
        return await encodePngQuantized(imageData, pTry, 0, 100);
      } catch {
        return encodeLossless(imageData, 'png');
      }
    }
    throw err;
  }
}
