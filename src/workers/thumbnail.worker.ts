/**
 * Dedicated thumbnail worker: keeps previews off the optimizer pool and main thread.
 * SVG thumbnails use Resvg (same WASM as the optimizer) — not createImageBitmap on raw SVG.
 */

import type { ThumbnailWorkerInbound, ThumbnailWorkerOutbound } from '../thumbnails/thumbnail-protocol';
import { checkPixelLimit } from './raster-encode';
import { ensureResvg, Resvg } from './optimizer-wasm';

const MAX_EDGE_PX = 120;
const WEBP_QUALITY = 0.6;

function postOutbound(data: ThumbnailWorkerOutbound): void {
  (globalThis as unknown as { postMessage: (d: ThumbnailWorkerOutbound) => void }).postMessage(data);
}

function isSvgFile(file: File): boolean {
  if (file.type === 'image/svg+xml') return true;
  return file.name.toLowerCase().endsWith('.svg');
}

async function svgFileToBitmap(file: File): Promise<ImageBitmap> {
  const svgText = await file.text();
  await ensureResvg();
  const resvg = new Resvg(svgText, {
    fitTo: { mode: 'width', value: MAX_EDGE_PX },
  });
  const rendered = resvg.render();
  try {
    checkPixelLimit(rendered.width, rendered.height);
    const rgba = new Uint8ClampedArray(rendered.pixels);
    const imageData = new ImageData(rgba, rendered.width, rendered.height);
    return await createImageBitmap(imageData);
  } finally {
    rendered.free();
    resvg.free();
  }
}

async function decodeSourceToBitmap(file: File): Promise<ImageBitmap> {
  if (isSvgFile(file)) {
    return svgFileToBitmap(file);
  }
  return createImageBitmap(file);
}

let sharedCanvas: OffscreenCanvas | null = null;
let sharedCtx: OffscreenCanvasRenderingContext2D | null = null;

function getCanvasForSize(w: number, h: number): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
  if (!sharedCanvas) {
    sharedCanvas = new OffscreenCanvas(w, h);
    sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true })!;
  } else {
    sharedCanvas.width = w;
    sharedCanvas.height = h;
  }
  return { canvas: sharedCanvas, ctx: sharedCtx! };
}

self.onmessage = async (e: MessageEvent<ThumbnailWorkerInbound>) => {
  const msg = e.data;
  if (msg.type === 'PING') {
    postOutbound({ type: 'PONG' });
    return;
  }
  if (msg.type !== 'THUMB') return;

  const { id, file } = msg;
  try {
    const bmp = await decodeSourceToBitmap(file);
    const w = bmp.width;
    const h = bmp.height;
    const scale = Math.min(MAX_EDGE_PX / w, MAX_EDGE_PX / h, 1);
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const { canvas, ctx } = getCanvasForSize(tw, th);
    ctx.drawImage(bmp, 0, 0, tw, th);
    bmp.close();
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
    postOutbound({ type: 'THUMB_OK', id, blob });
  } catch (err) {
    postOutbound({
      type: 'THUMB_ERR',
      id,
      error: String(err),
    });
  }
};
