/**
 * Dedicated thumbnail worker: keeps previews off the optimizer pool and main thread.
 * SVG thumbnails use Resvg (same WASM as the optimizer) — not createImageBitmap on raw SVG.
 */

import * as Comlink from 'comlink';
import type { ThumbnailWorkerOutbound } from '../thumbnails/thumbnail-protocol';
import { checkPixelLimit } from './raster-encode';
import { ensureResvg, Resvg, ensureHeicDecoder } from './optimizer-wasm';
import { decodeHeic } from '../lib/codecs/raster/decode-heic';
import { checkMagicBytesFromBufferExport } from '@/lib/validation';
import { mimeForOutputFormat } from '@/constants/formats';

const MAX_EDGE_PX = 120;
const WEBP_QUALITY = 0.6;

async function heifBufferToBitmap(buffer: ArrayBuffer): Promise<ImageBitmap> {
  await ensureHeicDecoder();
  const raw = await decodeHeic(buffer);
  const imageData = new ImageData(
    new Uint8ClampedArray(raw.data),
    raw.width,
    raw.height
  );
  return await createImageBitmap(imageData);
}

async function svgBufferToBitmap(buffer: ArrayBuffer, maxEdge: number): Promise<ImageBitmap> {
  const svgText = new TextDecoder().decode(buffer);
  await ensureResvg();
  const resvg = new Resvg(svgText, {
    fitTo: { mode: 'width', value: maxEdge },
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

async function decodeSourceToBitmap(buffer: ArrayBuffer, type: string, maxEdge: number): Promise<ImageBitmap> {
  let effectiveType = type;

  if (!effectiveType || effectiveType === 'application/octet-stream') {
    const bytes = new Uint8Array(buffer);
    if (checkMagicBytesFromBufferExport(bytes, 'heic') || checkMagicBytesFromBufferExport(bytes, 'heif')) {
      effectiveType = mimeForOutputFormat('heic');
    } else if (checkMagicBytesFromBufferExport(bytes, 'svg')) {
      effectiveType = mimeForOutputFormat('svg');
    } else if (checkMagicBytesFromBufferExport(bytes, 'webp')) {
      effectiveType = mimeForOutputFormat('webp');
    } else if (checkMagicBytesFromBufferExport(bytes, 'jpeg')) {
      effectiveType = mimeForOutputFormat('jpeg');
    } else if (checkMagicBytesFromBufferExport(bytes, 'png')) {
      effectiveType = mimeForOutputFormat('png');
    }
  }

  if (effectiveType === mimeForOutputFormat('svg')) {
    return svgBufferToBitmap(buffer, maxEdge);
  }
  if (effectiveType === mimeForOutputFormat('heic') || effectiveType === mimeForOutputFormat('heif')) {
    return heifBufferToBitmap(buffer);
  }
  return createImageBitmap(new Blob([buffer], { type: effectiveType }));
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
  generate(id: string, buffer: ArrayBuffer, type: string, maxEdge?: number): Promise<ThumbnailWorkerOutbound>;
}

const api: ThumbnailAPI = {
  async generate(id: string, buffer: ArrayBuffer, type: string, maxEdge = MAX_EDGE_PX): Promise<ThumbnailWorkerOutbound> {
    try {
      const bmp = await decodeSourceToBitmap(buffer, type, maxEdge);
      const w = bmp.width;
      const h = bmp.height;
      const scale = Math.min(maxEdge / w, maxEdge / h, 1);
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));

      const { canvas, ctx } = getCanvasForSize(tw, th);
      ctx.drawImage(bmp, 0, 0, tw, th);
      bmp.close();
      const blob = await canvas.convertToBlob({ type: mimeForOutputFormat('webp'), quality: WEBP_QUALITY });
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
