import { optimise } from '@jsquash/oxipng'
import {
  encode_palette_to_png,
  ImageQuantizer,
} from 'libimagequant-wasm/wasm/libimagequant_wasm.js'

import type { ContentPreset } from '@/workers/classify'

import { ensureQuant } from '@/workers/optimizer-wasm'

import type { EncodeResult, RasterEncodePreset } from './types.ts'

import { toErrorMessage } from './io.ts'
import { PNG_MILD_QUANT_MAX, PNG_MILD_QUANT_MIN, PRESETS } from './presets.ts'

export async function encodePngLossless(imageData: ImageData): Promise<EncodeResult> {
  const rawPng = await imageDataToRawPng(imageData)
  const data = await optimise(rawPng, {
    interlace: false,
    level: 3,
    optimiseAlpha: true,
  })
  return { data, lossless: true }
}

export async function encodePngWithPreset(
  imageData: ImageData,
  pTry: RasterEncodePreset,
  smallTransparent: boolean,
  contentPreset?: ContentPreset,
): Promise<EncodeResult> {
  const useMildQuant =
    smallTransparent &&
    (contentPreset === 'photo' || (contentPreset === undefined && pTry === PRESETS.photo))
  const qMin = useMildQuant ? PNG_MILD_QUANT_MIN : pTry.png.quantMin
  const qMax = useMildQuant ? PNG_MILD_QUANT_MAX : pTry.png.quantMax

  try {
    const data = await encodePngQuantized(imageData, pTry, qMin, qMax)
    return { data, lossless: false }
  } catch (error) {
    const msg = toErrorMessage(error, '')
    if (msg.includes('QualityTooLow')) {
      const data = await encodePngQuantized(imageData, pTry, 0, 100)
      return { data, lossless: false }
    }
    throw error
  }
}

async function encodePngQuantized(
  imageData: ImageData,
  pTry: RasterEncodePreset,
  qMin: number,
  qMax: number,
): Promise<ArrayBuffer> {
  await ensureQuant()
  const q = new ImageQuantizer()
  try {
    q.setQuality(qMin, qMax)
    const res = q.quantizeImage(imageData.data, imageData.width, imageData.height)
    try {
      const qPng = encode_palette_to_png(
        res.getPaletteIndices(imageData.data, imageData.width, imageData.height),
        res.getPalette(),
        imageData.width,
        imageData.height,
      )
      return optimise(qPng.buffer as ArrayBuffer, {
        interlace: false,
        level: pTry.png.oxipngLevel,
        optimiseAlpha: true,
      })
    } finally {
      res.free()
    }
  } finally {
    q.free()
  }
}

async function imageDataToRawPng(imageData: ImageData): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2d context for lossless PNG')
    ctx.putImageData(imageData, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return blob.arrayBuffer()
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}
