/**
 * WASM module initialization: Resvg (SVG rasterization) and libimagequant (PNG quantization).
 * Single responsibility: load and expose initialized WASM instances.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm';
import initQuant from 'libimagequant-wasm/wasm/libimagequant_wasm.js';
import { heic } from 'icodec';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?url';
import quantWasm from 'libimagequant-wasm/wasm/libimagequant_wasm_bg.wasm?url';
import heicDecWasm from 'icodec/heic-dec.wasm?url';
import heicEncWasm from 'icodec/heic-enc.wasm?url';

let resvgInitialized = false;
let quantInitialized = false;
let heicDecoderInitialized = false;
let heicEncoderInitialized = false;

export async function ensureResvg(): Promise<void> {
  if (resvgInitialized) return;
  const wasmRes = await fetch(resvgWasm);
  const wasmBuffer = await wasmRes.arrayBuffer();
  await initWasm(wasmBuffer);
  resvgInitialized = true;
}

export async function ensureQuant(): Promise<void> {
  if (quantInitialized) return;
  const wasmRes = await fetch(quantWasm);
  const wasmBuffer = await wasmRes.arrayBuffer();
  await initQuant({ wasmBinary: wasmBuffer });
  quantInitialized = true;
}

export async function ensureHeicDecoder(): Promise<void> {
  if (heicDecoderInitialized) return;
  await heic.loadDecoder(heicDecWasm);
  heicDecoderInitialized = true;
}

export async function ensureHeicEncoder(): Promise<void> {
  if (heicEncoderInitialized) return;
  await heic.loadEncoder(heicEncWasm);
  heicEncoderInitialized = true;
}

export { Resvg };
