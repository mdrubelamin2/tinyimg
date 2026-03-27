/**
 * PNG codec plugin: libimagequant (lossy quantization) + OxiPNG (lossless optimization).
 * This is the two-stage pipeline that matches TinyPNG's approach.
 */

import type { CodecPlugin, EncodeOptions } from './types.ts';

let initPromise: Promise<void> | null = null;

const pngCodec: CodecPlugin = {
  id: 'imagequant-oxipng',
  format: 'png',
  capabilities: {
    encode: true,
    decode: false,
    lossless: true,
    transparency: true,
    animation: false,
    simd: false,
  },

  async init() {
    if (!initPromise) {
      initPromise = Promise.all([
        import('@jsquash/oxipng'),
        import('libimagequant-wasm/wasm/libimagequant_wasm.js'),
      ]).then(() => {});
    }
    return initPromise;
  },

  async encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer> {
    // PNG encode uses the existing raster-encode pipeline for now.
    // The full libimagequant → OxiPNG pipeline is in raster-encode.ts.
    // This codec plugin is a registration stub; the actual encode path
    // is still in the worker's raster-encode.ts until full migration.
    const png = await import('@jsquash/oxipng');
    // Simple fallback: render to canvas PNG, then optimize with OxiPNG
    const canvas = new OffscreenCanvas(data.width, data.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context for PNG encode');
    ctx.putImageData(data, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const rawPng = await blob.arrayBuffer();
    return png.optimise(rawPng, {
      level: options['oxipngLevel'] as number ?? 2,
      interlace: false,
      optimiseAlpha: true,
    });
  },
};

export default pngCodec;
