/**
 * WASM module initialization: Resvg (SVG rasterization) and libimagequant (PNG quantization).
 * Single responsibility: load and expose initialized WASM instances.
 * 2026 optimization: Uses streaming compilation for faster startup.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm';
import initQuant from 'libimagequant-wasm/wasm/libimagequant_wasm.js';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?url';
import quantWasm from 'libimagequant-wasm/wasm/libimagequant_wasm_bg.wasm?url';

let resvgInitialized = false;
let quantInitialized = false;

export async function ensureResvg(): Promise<void> {
  if (resvgInitialized) return;

  // 2026: Use streaming compilation for faster WASM loading
  // Falls back to fetch + arrayBuffer if streaming fails
  try {
    const response = await fetch(resvgWasm);
    if (response.body && typeof WebAssembly.instantiateStreaming === 'function') {
      // Streaming path: compile while downloading (faster)
      const wasmModule = await WebAssembly.compileStreaming(response);
      await initWasm(wasmModule);
    } else {
      // Fallback: traditional fetch + arrayBuffer
      const wasmBuffer = await response.arrayBuffer();
      await initWasm(wasmBuffer);
    }
    resvgInitialized = true;
  } catch {
    // Fallback to original implementation
    const wasmRes = await fetch(resvgWasm);
    const wasmBuffer = await wasmRes.arrayBuffer();
    await initWasm(wasmBuffer);
    resvgInitialized = true;
  }
}

export async function ensureQuant(): Promise<void> {
  if (quantInitialized) return;

  // 2026: Use streaming compilation for faster WASM loading
  try {
    const response = await fetch(quantWasm);
    if (response.body && typeof WebAssembly.instantiateStreaming === 'function') {
      // Streaming path: compile while downloading (faster)
      const wasmModule = await WebAssembly.compileStreaming(response);
      await initQuant({ module: wasmModule });
    } else {
      // Fallback: traditional fetch + arrayBuffer
      const wasmBuffer = await response.arrayBuffer();
      await initQuant({ wasmBinary: wasmBuffer });
    }
    quantInitialized = true;
  } catch {
    // Fallback to original implementation
    const wasmRes = await fetch(quantWasm);
    const wasmBuffer = await wasmRes.arrayBuffer();
    await initQuant({ wasmBinary: wasmBuffer });
    quantInitialized = true;
  }
}

export { Resvg };
