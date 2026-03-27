/**
 * AVIF codec plugin: aomenc via @jsquash/avif.
 */

import type { CodecPlugin, EncodeOptions } from './types.ts';

let initPromise: Promise<void> | null = null;

const avifCodec: CodecPlugin = {
  id: 'aomenc',
  format: 'avif',
  capabilities: {
    encode: true,
    decode: true,
    lossless: true,
    transparency: true,
    animation: false,
    simd: false,
  },

  async init() {
    if (!initPromise) {
      initPromise = import('@jsquash/avif').then(() => {});
    }
    return initPromise;
  },

  async encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer> {
    const avif = await import('@jsquash/avif');
    const { quality, ...rest } = options;
    return avif.encode(data, { quality, ...rest });
  },

  async decode(data: ArrayBuffer): Promise<ImageData> {
    const avif = await import('@jsquash/avif');
    const result = await avif.decode(data);
    if (!result) throw new Error('AVIF decode returned null');
    return result;
  },
};

export default avifCodec;
