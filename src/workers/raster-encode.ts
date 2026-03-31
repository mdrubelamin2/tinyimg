/**
 * Raster encode: bitmap to ImageData, pixel limit check, and AVIF/WebP/JPEG/PNG encoding.
 * Content-aware presets (photo vs graphic). See docs/DESIGN-perfect-optimizer.md.
 */

import * as webp from '@jsquash/webp';
import * as avif from '@jsquash/avif';
import * as jpeg from '@jsquash/jpeg';
import * as png from '@jsquash/oxipng';
import { ImageQuantizer, encode_palette_to_png } from 'libimagequant-wasm/wasm/libimagequant_wasm.js';
import { MAX_PIXELS, LOSSLESS_SIZE_GUARD_RATIO } from '@/constants/index';
import { ensureQuant } from './optimizer-wasm';
import type { ContentPreset } from './classify';
import { isSmallAndTransparent } from './classify';
import { GpuResizeClient } from '@/lib/gpu/gpu-worker-client';
import { probeHardwareSupport, type HardwareCapabilities } from '@/lib/hardware';
import { bufferPool } from '@/lib/buffer-pool';

let gpuClient: GpuResizeClient | null = null;
let hardwareCaps: HardwareCapabilities | null = null;

const AVIFTune = { auto: 0, psnr: 1, ssim: 2 } as const;
const WEBP_QUALITY_TRANSPARENT = 77;
const PNG_MILD_QUANT_MIN = 90;
const PNG_MILD_QUANT_MAX = 98;

/** High-fidelity preset for SVG display-density mode (aligns with convert_logos WebP q≈100 intent). */
const SVG_DISPLAY_VECTOR_PRESET = {
  avif: {
    quality: 90,
    speed: 3,
    subsample: 0,
    chromaDeltaQ: true,
    sharpness: 1,
    enableSharpYUV: true,
    tune: AVIFTune.ssim,
  },
  webp: {
    quality: 100,
    method: 6,
    use_sharp_yuv: 1,
    sns_strength: 0,
    filter_strength: 0,
    filter_sharpness: 0,
    autofilter: 0,
    exact: 1,
    near_lossless: 100,
    alpha_quality: 100,
  },
  jpeg: {
    quality: 98,
    progressive: true,
    trellis_multipass: true,
    trellis_opt_zero: true,
    trellis_opt_table: true,
    trellis_loops: 1,
    chroma_subsample: 0,
    separate_chroma_quality: true,
    chroma_quality: 98,
  },
  png: { quantMin: 92, quantMax: 99, oxipngLevel: 3 },
} as const;

const SVG_VECTOR_SAFE_PRESET = {
  avif: {
    quality: 75,
    speed: 4,
    subsample: 0,
    chromaDeltaQ: true,
    sharpness: 1,
    enableSharpYUV: true,
    tune: AVIFTune.ssim,
  },
  webp: {
    quality: 86,
    method: 4,
    use_sharp_yuv: 1,
    sns_strength: 0,
    filter_strength: 0,
    filter_sharpness: 7,
    autofilter: 0,
    exact: 1,
    near_lossless: 90,
    alpha_quality: 100,
  },
  jpeg: {
    quality: 88,
    progressive: true,
    trellis_multipass: true,
    trellis_opt_zero: true,
    trellis_opt_table: true,
    trellis_loops: 1,
    chroma_subsample: 0,
    separate_chroma_quality: true,
    chroma_quality: 92,
  },
  png: { quantMin: 90, quantMax: 99, oxipngLevel: 2 },
} as const;

export const PRESETS = {
  photo: {
    avif: { quality: 55, speed: 6, subsample: 1, enableSharpYUV: true, tune: AVIFTune.ssim },
    webp: { quality: 72, method: 4, use_sharp_yuv: 1 },
    jpeg: { quality: 74, progressive: true, trellis_multipass: true, trellis_opt_zero: true, trellis_opt_table: true, trellis_loops: 1, chroma_subsample: 1 },
    png: { quantMin: 58, quantMax: 78, oxipngLevel: 2 },
  },
  graphic: {
    avif: { quality: 56, speed: 5, subsample: 2, chromaDeltaQ: true, enableSharpYUV: true, tune: AVIFTune.ssim },
    webp: { quality: 74, method: 5, use_sharp_yuv: 1 },
    jpeg: { quality: 76, progressive: true, trellis_multipass: true, trellis_opt_zero: true, trellis_opt_table: true, trellis_loops: 1, chroma_subsample: 0 },
    png: { quantMin: 58, quantMax: 78, oxipngLevel: 4 },
  },
} as const;

interface RasterEncodePreset {
  avif: {
    quality: number;
    speed: number;
    subsample: number;
    enableSharpYUV: boolean;
    tune: number;
    chromaDeltaQ?: boolean;
    sharpness?: number;
  };
  webp: {
    quality: number;
    method: number;
    use_sharp_yuv: number;
    sns_strength?: number;
    filter_strength?: number;
    filter_sharpness?: number;
    autofilter?: number;
    exact?: number;
    near_lossless?: number;
    alpha_quality?: number;
  };
  jpeg: {
    quality: number;
    progressive: boolean;
    trellis_multipass: boolean;
    trellis_opt_zero: boolean;
    trellis_opt_table: boolean;
    trellis_loops: number;
    chroma_subsample: number;
    separate_chroma_quality?: boolean;
    chroma_quality?: number;
  };
  png: {
    quantMin: number;
    quantMax: number;
    oxipngLevel: number;
  };
}

export async function resizeImage(
  bitmap: ImageBitmap,
  width: number,
  height: number
): Promise<ImageData> {
  if (!hardwareCaps) {
    hardwareCaps = await probeHardwareSupport();
  }

  if (hardwareCaps.webGpu && !gpuClient) {
    gpuClient = new GpuResizeClient();
  }

  if (gpuClient) {
    try {
      return await gpuClient.resize(bitmap, width, height);
    } catch (e) {
      console.warn('GPU resize failed, falling back to CPU', e);
    }
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context for resize');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  // Use buffer pool for the underlying ArrayBuffer
  const pooledBuffer = bufferPool.acquire(imageData.data.byteLength);
  const pooledData = new Uint8ClampedArray(pooledBuffer, 0, imageData.data.length);
  pooledData.set(imageData.data);

  return new ImageData(pooledData, width, height);
}

export async function getImageData(bitmap: ImageBitmap): Promise<ImageData> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2d context');
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

  // Use buffer pool for the underlying ArrayBuffer
  const pooledBuffer = bufferPool.acquire(imageData.data.byteLength);
  const pooledData = new Uint8ClampedArray(pooledBuffer, 0, imageData.data.length);
  pooledData.set(imageData.data);

  return new ImageData(pooledData, bitmap.width, bitmap.height);
}

export function checkPixelLimit(width: number, height: number): void {
  const total = width * height;
  if (total > MAX_PIXELS || !Number.isFinite(total)) {
    throw new Error(`Image dimensions too large (${(total / 1_000_000).toFixed(1)}MP). Maximum supported: ${(MAX_PIXELS / 1_000_000).toFixed(0)}MP (~7K×7K)`);
  }
}

/** Normalize format for encoding: "jpg" -> "jpeg", "original" -> ext or webp. */
export function normalizeOutputFormat(requested: string, ext: string | undefined): string {
  if (requested === 'original') return ext === 'jpg' ? 'jpeg' : (ext ?? 'webp');
  return requested === 'jpg' ? 'jpeg' : requested;
}

/** Native zero-memory-spike base64 encoding using FileReader */
export async function toBase64(buffer: ArrayBuffer): Promise<string> {
  const blob = new Blob([buffer]);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      if (base64) resolve(base64);
      else reject(new Error('Failed to parse base64 from Data URL'));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error ?? fallback);
}

/** GPU-accelerated Alpha Pre-multiplication on White background */
export async function compositeImageDataOnWhite(imageData: ImageData): Promise<ImageData> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2d context for composite');

  // Fill background with white
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, imageData.width, imageData.height);

  // Draw the image data on top with source-over
  const bitmap = await createImageBitmap(imageData);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const composited = ctx.getImageData(0, 0, imageData.width, imageData.height);

  // Use buffer pool for the underlying ArrayBuffer
  const pooledBuffer = bufferPool.acquire(composited.data.byteLength);
  const pooledData = new Uint8ClampedArray(pooledBuffer, 0, composited.data.length);
  pooledData.set(composited.data);

  return new ImageData(pooledData, imageData.width, imageData.height);
}

function hasTransparency(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 255) return true;
  }
  return false;
}

export async function encodeRaster(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png',
  preset: ContentPreset
): Promise<ArrayBuffer> {
  const pTry = PRESETS[preset];
  return encodeRasterWithPreset(imageData, format, pTry, false);
}

export async function encodeRasterVectorSafe(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png'
): Promise<ArrayBuffer> {
  return encodeRasterWithPreset(imageData, format, SVG_VECTOR_SAFE_PRESET, true);
}

async function imageDataToRawPng(imageData: ImageData): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context for lossless PNG');
  ctx.putImageData(imageData, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return blob.arrayBuffer();
}

async function encodeLossless(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png'
): Promise<ArrayBuffer> {
  switch (format) {
    case 'webp':
      return webp.encode(imageData, {
        lossless: 1,
        quality: 75,
        method: 4,
        exact: 1,
      });
    case 'avif':
      return avif.encode(imageData, { lossless: true });
    case 'png': {
      const rawPng = await imageDataToRawPng(imageData);
      return png.optimise(rawPng, { level: 3, interlace: false, optimiseAlpha: true });
    }
    case 'jpeg': {
      const jpegInput = hasTransparency(imageData.data)
        ? await compositeImageDataOnWhite(imageData)
        : imageData;
      return jpeg.encode(jpegInput, {
        quality: 100,
        progressive: true,
        trellis_multipass: true,
        trellis_opt_zero: true,
        trellis_opt_table: true,
        trellis_loops: 1,
        chroma_subsample: 0,
      });
    }
    default:
      return webp.encode(imageData, { lossless: 1, quality: 75, method: 4, exact: 1 });
  }
}

export async function encodeRasterVectorSafeWithSizeSafeguard(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png',
  options?: { displayQuality?: boolean }
): Promise<ArrayBuffer> {
  const vectorPreset = options?.displayQuality
    ? (SVG_DISPLAY_VECTOR_PRESET as unknown as RasterEncodePreset)
    : SVG_VECTOR_SAFE_PRESET;
  const losslessBytes = await encodeLossless(imageData, format);
  const lossyBytes = await encodeRasterWithPreset(
    imageData,
    format,
    vectorPreset,
    true
  );

  if (losslessBytes.byteLength <= lossyBytes.byteLength * LOSSLESS_SIZE_GUARD_RATIO) {
    return losslessBytes;
  }

  return lossyBytes;
}

async function encodeRasterWithPreset(
  imageData: ImageData,
  format: 'avif' | 'webp' | 'jpeg' | 'png',
  pTry: RasterEncodePreset,
  disableSmallTransparentWebpFallback: boolean
): Promise<ArrayBuffer> {
  const smallTransparent = isSmallAndTransparent(imageData.width, imageData.height, imageData.data);

  switch (format) {
    case 'avif':
      return avif.encode(imageData, { ...pTry.avif });
    case 'webp': {
      const webpQuality =
        smallTransparent && !disableSmallTransparentWebpFallback
          ? WEBP_QUALITY_TRANSPARENT
          : pTry.webp.quality;
      return webp.encode(imageData, {
        quality: webpQuality,
        method: pTry.webp.method,
        use_sharp_yuv: pTry.webp.use_sharp_yuv,
        ...(pTry.webp.sns_strength != null ? { sns_strength: pTry.webp.sns_strength } : {}),
        ...(pTry.webp.filter_strength != null
          ? { filter_strength: pTry.webp.filter_strength }
          : {}),
        ...(pTry.webp.filter_sharpness != null
          ? { filter_sharpness: pTry.webp.filter_sharpness }
          : {}),
        ...(pTry.webp.autofilter != null ? { autofilter: pTry.webp.autofilter } : {}),
        ...(pTry.webp.exact != null ? { exact: pTry.webp.exact } : {}),
        ...(pTry.webp.near_lossless != null
          ? { near_lossless: pTry.webp.near_lossless }
          : {}),
        ...(pTry.webp.alpha_quality != null
          ? { alpha_quality: pTry.webp.alpha_quality }
          : {}),
      });
    }
    case 'jpeg': {
      const jpegInput = hasTransparency(imageData.data)
        ? await compositeImageDataOnWhite(imageData)
        : imageData;
      return jpeg.encode(jpegInput, {
        quality: pTry.jpeg.quality,
        progressive: pTry.jpeg.progressive,
        trellis_multipass: pTry.jpeg.trellis_multipass,
        trellis_opt_zero: pTry.jpeg.trellis_opt_zero,
        trellis_opt_table: pTry.jpeg.trellis_opt_table,
        trellis_loops: pTry.jpeg.trellis_loops,
        chroma_subsample: pTry.jpeg.chroma_subsample,
        ...(pTry.jpeg.separate_chroma_quality != null
          ? { separate_chroma_quality: pTry.jpeg.separate_chroma_quality }
          : {}),
        ...(pTry.jpeg.chroma_quality != null
          ? { chroma_quality: pTry.jpeg.chroma_quality }
          : {}),
      });
    }
    case 'png': {
      await ensureQuant();
      const q = new ImageQuantizer();
      try {
        const useMildQuant = smallTransparent && pTry === PRESETS.photo;
        const qMin = useMildQuant ? PNG_MILD_QUANT_MIN : pTry.png.quantMin;
        const qMax = useMildQuant ? PNG_MILD_QUANT_MAX : pTry.png.quantMax;
        q.setQuality(qMin, qMax);
        const res = q.quantizeImage(imageData.data, imageData.width, imageData.height);
        try {
          const qPng = encode_palette_to_png(
            res.getPaletteIndices(imageData.data, imageData.width, imageData.height),
            res.getPalette(),
            imageData.width,
            imageData.height
          );
          return png.optimise(qPng.buffer as ArrayBuffer, {
            level: pTry.png.oxipngLevel,
            interlace: false,
            optimiseAlpha: true,
          });
        } finally {
          res.free();
        }
      } finally {
        q.free();
      }
    }
    default:
      return webp.encode(imageData, {
        quality: pTry.webp.quality,
        method: pTry.webp.method,
        use_sharp_yuv: pTry.webp.use_sharp_yuv,
      });
  }
}

/** Encode with fallback: try graphic preset, then photo if needed. */
export async function encodeRasterWithFallback(
  imageData: ImageData,
  effectiveFormat: string,
  preset: ContentPreset
): Promise<ArrayBuffer> {
  const maxAttempts = preset === 'graphic' ? 2 : 1;
  const format = (effectiveFormat === 'svg' ? 'webp' : effectiveFormat) as 'avif' | 'webp' | 'jpeg' | 'png';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await encodeRaster(imageData, format, attempt === 0 ? preset : 'photo');
    } catch (err) {
      if (attempt < maxAttempts - 1) continue;
      throw new Error(
        `${effectiveFormat.toUpperCase()} encode failed: ${toErrorMessage(err, 'encoding error')}`
      );
    }
  }
  throw new Error('Encode failed');
}
