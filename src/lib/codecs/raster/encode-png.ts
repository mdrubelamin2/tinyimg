import * as png from '@jsquash/oxipng';
import { ImageQuantizer, encode_palette_to_png } from 'libimagequant-wasm/wasm/libimagequant_wasm.js';
import { ensureQuant } from '@/workers/optimizer-wasm';
import type { RasterEncodePreset } from './types.ts';
import { PRESETS, PNG_MILD_QUANT_MAX, PNG_MILD_QUANT_MIN } from './presets.ts';

export async function encodePngWithPreset(
  imageData: ImageData,
  pTry: RasterEncodePreset,
  smallTransparent: boolean
): Promise<ArrayBuffer> {
  await ensureQuant();
  const q = new ImageQuantizer();
  try {
    const useMildQuant = smallTransparent && pTry === PRESETS.photo;
    const qMin = useMildQuant ? PNG_MILD_QUANT_MIN : pTry.png.quantMin;
    const qMax = useMildQuant ? PNG_MILD_QUANT_MAX : pTry.png.quantMax;
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
