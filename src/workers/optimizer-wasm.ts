/**
 * WASM module initialization: Resvg (SVG rasterization) and libimagequant (PNG quantization).
 * All WASM assets load lazily on first use per codec path.
 */

let resvgPromise: null | Promise<void> = null
let quantPromise: null | Promise<void> = null
let heicDecoderPromise: null | Promise<void> = null
let heicEncoderPromise: null | Promise<void> = null

export async function ensureHeicDecoder(): Promise<void> {
  if (heicDecoderPromise) return heicDecoderPromise
  heicDecoderPromise = (async () => {
    const [{ heic }, { default: heicDecWasm }] = await Promise.all([
      import('icodec'),
      import('icodec/heic-dec.wasm?url'),
    ])
    await heic.loadDecoder(heicDecWasm)
  })()
  await heicDecoderPromise
}

export async function ensureHeicEncoder(): Promise<void> {
  if (heicEncoderPromise) return heicEncoderPromise
  heicEncoderPromise = (async () => {
    const [{ heic }, { default: heicEncWasm }] = await Promise.all([
      import('icodec'),
      import('icodec/heic-enc.wasm?url'),
    ])
    await heic.loadEncoder(heicEncWasm)
  })()
  await heicEncoderPromise
}

export async function ensureQuant(): Promise<void> {
  if (quantPromise) return quantPromise
  quantPromise = (async () => {
    const [{ default: initQuant }, { default: quantWasm }] = await Promise.all([
      import('libimagequant-wasm/wasm/libimagequant_wasm.js'),
      import('libimagequant-wasm/wasm/libimagequant_wasm_bg.wasm?url'),
    ])
    const wasmRes = await fetch(quantWasm)
    const wasmBuffer = await wasmRes.arrayBuffer()
    await initQuant({ wasmBinary: wasmBuffer })
  })()
  await quantPromise
}

export async function ensureResvg(): Promise<void> {
  if (resvgPromise) return resvgPromise
  resvgPromise = (async () => {
    const [{ initWasm }, { default: resvgWasm }] = await Promise.all([
      import('@resvg/resvg-wasm'),
      import('@resvg/resvg-wasm/index_bg.wasm?url'),
    ])
    const wasmRes = await fetch(resvgWasm)
    const wasmBuffer = await wasmRes.arrayBuffer()
    await initWasm(wasmBuffer)
  })()
  await resvgPromise
}
