import * as png from '@jsquash/oxipng';
import { ImageQuantizer, encode_palette_to_png } from 'libimagequant-wasm/wasm/libimagequant_wasm.js';
import { ensureQuant } from '@/workers/optimizer-wasm';
import type { ContentPreset } from '@/workers/classify';
import type { RasterEncodePreset, EncodeResult } from './types.ts';
import { PRESETS, PNG_MILD_QUANT_MAX, PNG_MILD_QUANT_MIN } from './presets.ts';
import { toErrorMessage } from './io.ts';

async function imageDataToRawPng(imageData: ImageData): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context for lossless PNG');
    ctx.putImageData(imageData, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blob.arrayBuffer();
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function encodePngLossless(imageData: ImageData): Promise<EncodeResult> {
  const rawPng = await imageDataToRawPng(imageData);
  const data = await png.optimise(rawPng, { level: 3, interlace: false, optimiseAlpha: true });
  return { data, lossless: true };
}

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
): Promise<EncodeResult> {
  const useMildQuant =
    smallTransparent &&
    (contentPreset === 'photo' || (contentPreset === undefined && pTry === PRESETS.photo));
  const qMin = useMildQuant ? PNG_MILD_QUANT_MIN : pTry.png.quantMin;
  const qMax = useMildQuant ? PNG_MILD_QUANT_MAX : pTry.png.quantMax;

  try {
    const data = await encodePngQuantized(imageData, pTry, qMin, qMax);
    return { data, lossless: false };
  } catch (err) {
    const msg = toErrorMessage(err, '');
    if (msg.includes('QualityTooLow')) {
      const data = await encodePngQuantized(imageData, pTry, 0, 100);
      return { data, lossless: false };
    }
    throw err;
  }
}
