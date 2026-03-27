/**
 * WASM module initialization: Resvg (SVG rasterization) and libimagequant (PNG quantization).
 * Single responsibility: load and expose initialized WASM instances.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm';
import initQuant from 'libimagequant-wasm/wasm/libimagequant_wasm.js';

const RESVG_WASM_URL = new URL('@resvg/resvg-wasm/index_bg.wasm', import.meta.url);
const QUANT_WASM_URL = new URL('libimagequant-wasm/wasm/libimagequant_wasm_bg.wasm', import.meta.url);

let resvgInitialized = false;
let quantInitialized = false;

export async function ensureResvg(): Promise<void> {
  if (resvgInitialized) return;
  const wasmRes = await fetch(RESVG_WASM_URL);
  const wasmBuffer = await wasmRes.arrayBuffer();
  await initWasm(wasmBuffer);
  resvgInitialized = true;
}

export async function ensureQuant(): Promise<void> {
  if (quantInitialized) return;
  const wasmRes = await fetch(QUANT_WASM_URL);
  const wasmBuffer = await wasmRes.arrayBuffer();
  await initQuant(wasmBuffer);
  quantInitialized = true;
}

export { Resvg };
