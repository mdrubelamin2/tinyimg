/**
 * WebP codec plugin: libwebp via @jsquash/webp.
 */

import type { CodecPlugin, EncodeOptions } from './types.ts';

let initPromise: Promise<void> | null = null;

const webpCodec: CodecPlugin = {
  id: 'libwebp',
  format: 'webp',
  capabilities: {
    encode: true,
    decode: true,
    lossless: true,
    transparency: true,
    animation: false,
    simd: true,
  },

  async init() {
    if (!initPromise) {
      initPromise = import('@jsquash/webp').then(() => {});
    }
    return initPromise;
  },

  async encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer> {
    const webp = await import('@jsquash/webp');
    const { quality, ...rest } = options;
    return webp.encode(data, { quality, ...rest });
  },

  async decode(data: ArrayBuffer): Promise<ImageData> {
    const webp = await import('@jsquash/webp');
    return webp.decode(data);
  },
};

export default webpCodec;
