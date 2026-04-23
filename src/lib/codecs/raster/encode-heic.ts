import type {  EncodeResult, RasterEncodePreset } from './types.ts';
import { heic } from 'icodec';

export interface HeifEncodeOptions {
  quality?: number;
  lossless?: boolean | undefined;
}

const getEncodedBuffer = (data: Uint8Array): ArrayBuffer => {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

export async function encodeHeicWithPreset(
  imageData: ImageData,
  pTry: RasterEncodePreset,
): Promise<EncodeResult> {
  const data = heic.encode({
    data: imageData.data,
    width: imageData.width,
    height: imageData.height,
    depth: 8,
  }, {
    quality: pTry.heic.quality,
    chroma: pTry.heic.chroma,
    lossless: false,
  });
  return { data: getEncodedBuffer(data), lossless: false };
}

export async function encodeHeicLossless(imageData: ImageData): Promise<EncodeResult> {
  const data = heic.encode({
    data: imageData.data,
    width: imageData.width,
    height: imageData.height,
    depth: 8,
  }, {
    lossless: true,
    chroma: '444',
  });
  return { data: getEncodedBuffer(data), lossless: true };
}
