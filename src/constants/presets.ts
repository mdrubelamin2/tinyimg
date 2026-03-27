/**
 * Encoder presets: content-aware quality constants for photo vs graphic.
 * Also classifier thresholds.
 * See docs/QUALITY-RESEARCH.md for rationale behind every number.
 */

// --- AVIF tune enum (matches @jsquash/avif API) ---
export const AVIFTune = { auto: 0, psnr: 1, ssim: 2 } as const;

// --- Classifier thresholds ---
export const SMALL_IMAGE_PX = 10_000;
export const GRAPHIC_COLOR_THRESHOLD = 2_500;
export const GRAPHIC_ENTROPY_THRESHOLD = 6.5;
export const MAX_PIXELS_FOR_CLASSIFY = 4_000_000;
export const HISTOGRAM_BINS = 256;
export const SMALL_TRANSPARENT_PX = 800_000;

// --- Luminance weights (BT.601) ---
export const LUMINANCE_R = 0.299;
export const LUMINANCE_G = 0.587;
export const LUMINANCE_B = 0.114;

// --- Size guard: if lossless exceeds lossy by this ratio, prefer lossy ---
export const LOSSLESS_SIZE_GUARD_RATIO = 1.3;

// --- SVG wrapper: use raster-wrapped SVG only if smaller than this ratio of optimized text SVG ---
export const WRAPPER_SIZE_THRESHOLD = 0.95;

// --- Encode-specific constants ---
export const WEBP_QUALITY_TRANSPARENT = 77;
export const PNG_MILD_QUANT_MIN = 90;
export const PNG_MILD_QUANT_MAX = 98;
export const BASE64_CHUNK_SIZE = 8192;

// --- Content preset type ---
export type ContentPreset = 'photo' | 'graphic';

// --- Raster encode preset shape ---
export interface RasterEncodePreset {
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

// --- Production presets (size-tuned for TinyPNG parity) ---
export const PRESETS: Record<ContentPreset, RasterEncodePreset> = {
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

/** High-fidelity preset for SVG display-density mode. */
export const SVG_DISPLAY_VECTOR_PRESET: RasterEncodePreset = {
  avif: {
    quality: 90, speed: 3, subsample: 0, chromaDeltaQ: true, sharpness: 1,
    enableSharpYUV: true, tune: AVIFTune.ssim,
  },
  webp: {
    quality: 100, method: 6, use_sharp_yuv: 1, sns_strength: 0,
    filter_strength: 0, filter_sharpness: 0, autofilter: 0, exact: 1,
    near_lossless: 100, alpha_quality: 100,
  },
  jpeg: {
    quality: 98, progressive: true, trellis_multipass: true, trellis_opt_zero: true,
    trellis_opt_table: true, trellis_loops: 1, chroma_subsample: 0,
    separate_chroma_quality: true, chroma_quality: 98,
  },
  png: { quantMin: 92, quantMax: 99, oxipngLevel: 3 },
} as const;

/** Safe preset for SVG raster fallback (slightly less aggressive than display). */
export const SVG_VECTOR_SAFE_PRESET: RasterEncodePreset = {
  avif: {
    quality: 75, speed: 4, subsample: 0, chromaDeltaQ: true, sharpness: 1,
    enableSharpYUV: true, tune: AVIFTune.ssim,
  },
  webp: {
    quality: 86, method: 4, use_sharp_yuv: 1, sns_strength: 0,
    filter_strength: 0, filter_sharpness: 7, autofilter: 0, exact: 1,
    near_lossless: 90, alpha_quality: 100,
  },
  jpeg: {
    quality: 88, progressive: true, trellis_multipass: true, trellis_opt_zero: true,
    trellis_opt_table: true, trellis_loops: 1, chroma_subsample: 0,
    separate_chroma_quality: true, chroma_quality: 92,
  },
  png: { quantMin: 90, quantMax: 99, oxipngLevel: 2 },
} as const;

// --- Preset interpolation for quality slider ---

/**
 * Linearly interpolate between min and max quality for a given slider value (1-100).
 * At 100: use safe presets (high quality). At 1: maximum compression.
 */
export function lerpQuality(min: number, max: number, qualityPercent: number): number {
  const t = Math.max(0, Math.min(1, qualityPercent / 100));
  return Math.round(min + (max - min) * t);
}

// --- Quality interpolation ranges (min at slider=1, max at slider=100) ---
export const QUALITY_RANGE = {
  avif:  { min: 20, max: 80 },
  webp:  { min: 30, max: 95 },
  jpeg:  { min: 30, max: 95 },
  png:   { minQ: { min: 20, max: 72 }, maxQ: { min: 50, max: 92 } },
} as const;
