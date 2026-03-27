/**
 * JXL codec plugin: libjxl via @jsquash/jxl.
 * Status: experimental. Chrome 145+ has decode behind flag. Safari 17+ full support.
 */

import type { CodecPlugin, EncodeOptions } from './types.ts';

let initPromise: Promise<void> | null = null;

const jxlCodec: CodecPlugin = {
  id: 'libjxl',
  format: 'jxl',
  capabilities: {
    encode: true,
    decode: true,
    lossless: true,
    transparency: true,
    animation: true,
    simd: false,
  },

  async init() {
    if (!initPromise) {
      initPromise = import('@jsquash/jxl').then(() => {});
    }
    return initPromise;
  },

  async encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer> {
    const jxl = await import('@jsquash/jxl');
    const { quality, ...rest } = options;
    return jxl.encode(data, { quality, ...rest });
  },

  async decode(data: ArrayBuffer): Promise<ImageData> {
    const jxl = await import('@jsquash/jxl');
    return jxl.decode(data);
  },
};

export default jxlCodec;
