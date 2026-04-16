/**
 * Production and SVG vector presets — verbatim from historical raster-encode.ts.
 */

const AVIFTune = { auto: 0, psnr: 1, ssim: 2 } as const;

export const WEBP_QUALITY_TRANSPARENT = 77;
export const PNG_MILD_QUANT_MIN = 90;
export const PNG_MILD_QUANT_MAX = 98;

/** High-fidelity preset for SVG display-density mode (aligns with convert_logos WebP q≈100 intent). */
export const SVG_DISPLAY_VECTOR_PRESET = {
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

export const SVG_VECTOR_SAFE_PRESET = {
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
