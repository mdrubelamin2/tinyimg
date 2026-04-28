import { heic } from 'icodec'

import type { EncodeResult, RasterEncodePreset } from './types.ts'

export interface HeifEncodeOptions {
  lossless?: boolean | undefined
  quality?: number
}

const getEncodedBuffer = (data: Uint8Array): ArrayBuffer => {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

export async function encodeHeicLossless(imageData: ImageData): Promise<EncodeResult> {
  const data = heic.encode(
    {
      data: imageData.data,
      depth: 8,
      height: imageData.height,
      width: imageData.width,
    },
    {
      chroma: '444',
      lossless: true,
    },
  )
  return { data: getEncodedBuffer(data), lossless: true }
}

export async function encodeHeicWithPreset(
  imageData: ImageData,
  pTry: RasterEncodePreset,
): Promise<EncodeResult> {
  const data = heic.encode(
    {
      data: imageData.data,
      depth: 8,
      height: imageData.height,
      width: imageData.width,
    },
    {
      chroma: pTry.heic.chroma,
      lossless: false,
      quality: pTry.heic.quality,
    },
  )
  return { data: getEncodedBuffer(data), lossless: false }
}
