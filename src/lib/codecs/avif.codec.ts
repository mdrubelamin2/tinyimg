import type { CodecPlugin, EncodeOptions } from './types.ts';
import { encodeNativeAvif } from './avif.native.ts';
import { probeHardwareSupport } from '../hardware.ts';

let initPromise: Promise<void> | null = null;
let useNative = false;

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
      initPromise = (async () => {
        const caps = await probeHardwareSupport();
        useNative = caps.webCodecsAv1;
        if (!useNative) {
           await import('@jsquash/avif');
        }
      })();
    }
    return initPromise;
  },

  async encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer> {
    if (useNative) {
        try {
           return await encodeNativeAvif(data, options);
        } catch (e) {
           console.warn('Native WebCodecs AVIF encoding failed, falling back to WASM', e);
        }
    }
    
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
