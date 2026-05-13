/**
 * WASM module initialization: Resvg (SVG rasterization) and libimagequant (PNG quantization).
 * Single responsibility: load and expose initialized WASM instances.
 */

import { initWasm } from '@resvg/resvg-wasm'
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?url'
import { heic } from 'icodec'
import heicDecWasm from 'icodec/heic-dec.wasm?url'
import heicEncWasm from 'icodec/heic-enc.wasm?url'
import initQuant from 'libimagequant-wasm/wasm/libimagequant_wasm.js'
import quantWasm from 'libimagequant-wasm/wasm/libimagequant_wasm_bg.wasm?url'

let resvgPromise: null | Promise<void> = null
let quantPromise: null | Promise<void> = null
let heicDecoderPromise: null | Promise<void> = null
let heicEncoderPromise: null | Promise<void> = null

export async function ensureHeicDecoder(): Promise<void> {
  if (heicDecoderPromise) return heicDecoderPromise
  heicDecoderPromise = heic.loadDecoder(heicDecWasm)
  await heicDecoderPromise
}

export async function ensureHeicEncoder(): Promise<void> {
  if (heicEncoderPromise) return heicEncoderPromise
  heicEncoderPromise = heic.loadEncoder(heicEncWasm)
  await heicEncoderPromise
}

export async function ensureQuant(): Promise<void> {
  if (quantPromise) return quantPromise
  quantPromise = (async () => {
    const wasmRes = await fetch(quantWasm)
    const wasmBuffer = await wasmRes.arrayBuffer()
    await initQuant({ wasmBinary: wasmBuffer })
  })()
  await quantPromise
}

export async function ensureResvg(): Promise<void> {
  if (resvgPromise) return resvgPromise
  resvgPromise = (async () => {
    const wasmRes = await fetch(resvgWasm)
    const wasmBuffer = await wasmRes.arrayBuffer()
    await initWasm(wasmBuffer)
  })()
  await resvgPromise
}

export { Resvg } from '@resvg/resvg-wasm'
