/**
 * Encoder presets: content-aware quality constants for photo vs graphic.
 * Also classifier thresholds.
 * See docs/QUALITY-RESEARCH.md for rationale behind every number.
 */

// --- AVIF tune enum (matches @jsquash/avif API) ---
export const AVIFTune = { auto: 0, psnr: 1, ssim: 2 } as const

// --- Classifier thresholds ---
export const SMALL_IMAGE_PX = 10_000
export const GRAPHIC_COLOR_THRESHOLD = 2500
export const GRAPHIC_ENTROPY_THRESHOLD = 6.5
export const MAX_PIXELS_FOR_CLASSIFY = 4_000_000
export const HISTOGRAM_BINS = 256
export const SMALL_TRANSPARENT_PX = 800_000

// --- Luminance weights (BT.601) ---
export const LUMINANCE_R = 0.299
export const LUMINANCE_G = 0.587
export const LUMINANCE_B = 0.114

// --- Size guard: if lossless exceeds lossy by this ratio, prefer lossy ---
export const LOSSLESS_SIZE_GUARD_RATIO = 1.3

// --- SVG wrapper: use raster-wrapped SVG only if smaller than this ratio of optimized text SVG ---
export const WRAPPER_SIZE_THRESHOLD = 0.95

// --- Encode-specific constants ---
export const WEBP_QUALITY_TRANSPARENT = 77
export const PNG_MILD_QUANT_MIN = 90
export const PNG_MILD_QUANT_MAX = 98
export const BASE64_CHUNK_SIZE = 8192

// --- Content preset type ---
export type ContentPreset = 'graphic' | 'photo'

// --- Raster encode preset shape ---
export interface RasterEncodePreset {
  avif: {
    chromaDeltaQ?: boolean
    enableSharpYUV: boolean
    quality: number
    sharpness?: number
    speed: number
    subsample: number
    tune: number
  }
  jpeg: {
    chroma_quality?: number
    chroma_subsample: number
    progressive: boolean
    quality: number
    separate_chroma_quality?: boolean
    trellis_loops: number
    trellis_multipass: boolean
    trellis_opt_table: boolean
    trellis_opt_zero: boolean
  }
  png: {
    oxipngLevel: number
    quantMax: number
    quantMin: number
  }
  webp: {
    alpha_quality?: number
    autofilter?: number
    exact?: number
    filter_sharpness?: number
    filter_strength?: number
    method: number
    near_lossless?: number
    quality: number
    sns_strength?: number
    use_sharp_yuv: number
  }
}

// --- Production presets (size-tuned for TinyPNG parity) ---
export const PRESETS: Record<ContentPreset, RasterEncodePreset> = {
  graphic: {
    avif: {
      chromaDeltaQ: true,
      enableSharpYUV: true,
      quality: 56,
      speed: 5,
      subsample: 2,
      tune: AVIFTune.ssim,
    },
    jpeg: {
      chroma_subsample: 0,
      progressive: true,
      quality: 76,
      trellis_loops: 1,
      trellis_multipass: true,
      trellis_opt_table: true,
      trellis_opt_zero: true,
    },
    png: { oxipngLevel: 4, quantMax: 78, quantMin: 58 },
    webp: { method: 5, quality: 74, use_sharp_yuv: 1 },
  },
  photo: {
    avif: {
      enableSharpYUV: true,
      quality: 55,
      speed: 6,
      subsample: 1,
      tune: AVIFTune.ssim,
    },
    jpeg: {
      chroma_subsample: 1,
      progressive: true,
      quality: 74,
      trellis_loops: 1,
      trellis_multipass: true,
      trellis_opt_table: true,
      trellis_opt_zero: true,
    },
    png: { oxipngLevel: 2, quantMax: 78, quantMin: 58 },
    webp: { method: 4, quality: 72, use_sharp_yuv: 1 },
  },
} as const

/** High-fidelity preset for SVG display-density mode. */
export const SVG_DISPLAY_VECTOR_PRESET: RasterEncodePreset = {
  avif: {
    chromaDeltaQ: true,
    enableSharpYUV: true,
    quality: 90,
    sharpness: 1,
    speed: 3,
    subsample: 0,
    tune: AVIFTune.ssim,
  },
  jpeg: {
    chroma_quality: 98,
    chroma_subsample: 0,
    progressive: true,
    quality: 98,
    separate_chroma_quality: true,
    trellis_loops: 1,
    trellis_multipass: true,
    trellis_opt_table: true,
    trellis_opt_zero: true,
  },
  png: { oxipngLevel: 3, quantMax: 99, quantMin: 92 },
  webp: {
    alpha_quality: 100,
    autofilter: 0,
    exact: 1,
    filter_sharpness: 0,
    filter_strength: 0,
    method: 6,
    near_lossless: 100,
    quality: 100,
    sns_strength: 0,
    use_sharp_yuv: 1,
  },
} as const

/** Safe preset for SVG raster fallback (slightly less aggressive than display). */
export const SVG_VECTOR_SAFE_PRESET: RasterEncodePreset = {
  avif: {
    chromaDeltaQ: true,
    enableSharpYUV: true,
    quality: 75,
    sharpness: 1,
    speed: 4,
    subsample: 0,
    tune: AVIFTune.ssim,
  },
  jpeg: {
    chroma_quality: 92,
    chroma_subsample: 0,
    progressive: true,
    quality: 88,
    separate_chroma_quality: true,
    trellis_loops: 1,
    trellis_multipass: true,
    trellis_opt_table: true,
    trellis_opt_zero: true,
  },
  png: { oxipngLevel: 2, quantMax: 99, quantMin: 90 },
  webp: {
    alpha_quality: 100,
    autofilter: 0,
    exact: 1,
    filter_sharpness: 7,
    filter_strength: 0,
    method: 4,
    near_lossless: 90,
    quality: 86,
    sns_strength: 0,
    use_sharp_yuv: 1,
  },
} as const

// --- Preset interpolation for quality slider ---

/**
 * Linearly interpolate between min and max quality for a given slider value (1-100).
 * At 100: use safe presets (high quality). At 1: maximum compression.
 */
export function lerpQuality(min: number, max: number, qualityPercent: number): number {
  const t = Math.max(0, Math.min(1, qualityPercent / 100))
  return Math.round(min + (max - min) * t)
}

// --- Quality interpolation ranges (min at slider=1, max at slider=100) ---
export const QUALITY_RANGE = {
  avif: { max: 80, min: 20 },
  jpeg: { max: 95, min: 30 },
  png: { maxQ: { max: 92, min: 50 }, minQ: { max: 72, min: 20 } },
  webp: { max: 95, min: 30 },
} as const
