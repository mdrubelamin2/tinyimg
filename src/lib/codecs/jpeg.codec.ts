/**
 * JPEG codec plugin: MozJPEG via @jsquash/jpeg.
 * Future: swap this for a Jpegli WASM encoder when a permissive-license build is available.
 */

import type { CodecPlugin, EncodeOptions } from './types.ts';

let initPromise: Promise<void> | null = null;

const jpegCodec: CodecPlugin = {
  id: 'mozjpeg',
  format: 'jpeg',
  capabilities: {
    encode: true,
    decode: true,
    lossless: false,
    transparency: false,
    animation: false,
    simd: false,
  },

  async init() {
    if (!initPromise) {
      initPromise = import('@jsquash/jpeg').then(() => {});
    }
    return initPromise;
  },

  async encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer> {
    const jpeg = await import('@jsquash/jpeg');
    const { quality, ...rest } = options;
    return jpeg.encode(data, { quality, ...rest });
  },

  async decode(data: ArrayBuffer): Promise<ImageData> {
    const jpeg = await import('@jsquash/jpeg');
    return jpeg.decode(data);
  },
};

export default jpegCodec;
