/**
 * Rasterize SVG using the host browser engine (Chromium/WebKit/Gecko).
 * Used for display-density mode; falls back to resvg on failure.
 */

import { checkPixelLimit } from './raster-encode';

/**
 * Ensure root <svg> has explicit width/height so layout engines resolve size (SVGO may strip them).
 */
export function ensureSvgRootDimensions(svgText: string, width: number, height: number): string {
  try {
    if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const root = doc.documentElement;
      if (!root || root.tagName.toLowerCase() !== 'svg') {
        return injectSvgDimensionsStringFallback(svgText, width, height);
      }
      root.setAttribute('width', String(width));
      root.setAttribute('height', String(height));
      return new XMLSerializer().serializeToString(doc);
    }
  } catch {
    /* fall through */
  }
  return injectSvgDimensionsStringFallback(svgText, width, height);
}

/**
 * When DOMParser/XMLSerializer are missing or parse fails, inject width/height on the first <svg> tag.
 */
function injectSvgDimensionsStringFallback(svgText: string, width: number, height: number): string {
  const w = String(width);
  const h = String(height);
  const trimmed = svgText.trim();
  const idx = trimmed.search(/<svg\b/i);
  if (idx < 0) {
    return svgText;
  }
  const prefix = trimmed.slice(0, idx);
  const afterSvg = trimmed.slice(idx + 4);
  const leadingWs = afterSvg.match(/^\s*/)?.[0] ?? '';
  let attrs = afterSvg.slice(leadingWs.length);
  attrs = attrs.replace(/\bwidth\s*=\s*["'][^"']*["']\s*/gi, '');
  attrs = attrs.replace(/\bheight\s*=\s*["'][^"']*["']\s*/gi, '');
  const openTag = `<svg${leadingWs}`;
  const sep = leadingWs.length > 0 ? '' : ' ';
  return `${prefix}${openTag}${sep}width="${w}" height="${h}" ${attrs}`;
}

export class BrowserSvgRasterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserSvgRasterError';
  }
}

async function decodeSvgBlobToBitmap(
  blob: Blob,
  physW: number,
  physH: number
): Promise<ImageBitmap> {
  const errors: string[] = [];

  const tryBitmap = async (
    b: Blob,
    opts?: ImageBitmapOptions
  ): Promise<ImageBitmap | null> => {
    try {
      return opts != null ? await createImageBitmap(b, opts) : await createImageBitmap(b);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  // 1) Resize in decoder (Chrome-friendly; WebKit often rejects extra flags on SVG)
  let bitmap =
    (await tryBitmap(blob, { resizeWidth: physW, resizeHeight: physH, resizeQuality: 'high' })) ??
    (await tryBitmap(blob, { resizeWidth: physW, resizeHeight: physH }));

  // 2) Decode at intrinsic size, scale on canvas (Safari/Firefox often need this for SVG)
  if (!bitmap) {
    bitmap = await tryBitmap(blob);
  }

  // 3) Data URL + fresh blob (some engines decode SVG more reliably after fetch)
  if (!bitmap) {
    try {
      const text = await blob.text();
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
      const res = await fetch(dataUrl);
      const b2 = await res.blob();
      bitmap =
        (await tryBitmap(b2, { resizeWidth: physW, resizeHeight: physH })) ??
        (await tryBitmap(b2));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (!bitmap) {
    throw new BrowserSvgRasterError(
      `Could not decode SVG (${errors.length} attempts): ${errors[0] ?? 'unknown'}`
    );
  }

  return bitmap;
}

function bitmapToImageData(bitmap: ImageBitmap, physW: number, physH: number): ImageData {
  const canvas = new OffscreenCanvas(physW, physH);
  try {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new BrowserSvgRasterError('Could not get 2d context');
    }
    ctx.clearRect(0, 0, physW, physH);
    ctx.drawImage(bitmap, 0, 0, physW, physH);
    return ctx.getImageData(0, 0, physW, physH);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Rasterize SVG to RGBA ImageData at exact physical pixel size using createImageBitmap + OffscreenCanvas.
 */
export async function rasterizeSvgWithBrowser(
  svgText: string,
  logicalW: number,
  logicalH: number,
  physW: number,
  physH: number
): Promise<ImageData> {
  if (typeof createImageBitmap !== 'function') {
    throw new BrowserSvgRasterError('createImageBitmap is not available');
  }

  const prepared = ensureSvgRootDimensions(svgText, logicalW, logicalH);
  checkPixelLimit(physW, physH);

  const blob = new Blob([prepared], { type: 'image/svg+xml;charset=utf-8' });

  const bitmap = await decodeSvgBlobToBitmap(blob, physW, physH);
  try {
    return bitmapToImageData(bitmap, physW, physH);
  } finally {
    bitmap.close();
  }
}
