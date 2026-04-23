/**
 * Dedicated thumbnail worker: keeps previews off the optimizer pool and main thread.
 * SVG thumbnails use Resvg (same WASM as the optimizer) — not createImageBitmap on raw SVG.
 */

import * as Comlink from 'comlink';
import type { ThumbnailWorkerOutbound } from '../thumbnails/thumbnail-protocol';
import { checkPixelLimit } from './raster-encode';
import { ensureResvg, Resvg } from './optimizer-wasm';

const MAX_EDGE_PX = 120;
const WEBP_QUALITY = 0.6;

async function svgBufferToBitmap(buffer: ArrayBuffer): Promise<ImageBitmap> {
  const svgText = new TextDecoder().decode(buffer);
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

async function decodeSourceToBitmap(buffer: ArrayBuffer, type: string): Promise<ImageBitmap> {
  if (type === 'image/svg+xml') {
    return svgBufferToBitmap(buffer);
  }
  return createImageBitmap(new Blob([buffer], { type }));
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

export interface ThumbnailAPI {
  generate(id: string, buffer: ArrayBuffer, type: string): Promise<ThumbnailWorkerOutbound>;
}

const api: ThumbnailAPI = {
  async generate(id: string, buffer: ArrayBuffer, type: string): Promise<ThumbnailWorkerOutbound> {
    try {
      const bmp = await decodeSourceToBitmap(buffer, type);
      const w = bmp.width;
      const h = bmp.height;
      const scale = Math.min(MAX_EDGE_PX / w, MAX_EDGE_PX / h, 1);
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));

      const { canvas, ctx } = getCanvasForSize(tw, th);
      ctx.drawImage(bmp, 0, 0, tw, th);
      bmp.close();
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
      return Comlink.transfer({ type: 'THUMB_OK', id, blob, width: w, height: h }, [buffer]);
    } catch (err) {
      return {
        type: 'THUMB_ERR',
        id,
        error: String(err),
      };
    }
  }
};

self.onmessage = (event: MessageEvent<{ type: string; port: MessagePort }>) => {
  if (event.data?.type === 'INIT') {
    const port = event.data.port;
    Comlink.expose(api, port);
    port.start();
  }
};
