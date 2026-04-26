/**
 * Production and SVG vector presets — verbatim from historical raster-encode.ts.
 */

const AVIFTune = { auto: 0, psnr: 1, ssim: 2 } as const;

export const WEBP_QUALITY_TRANSPARENT = 77;
export const PNG_MILD_QUANT_MIN = 90;
export const PNG_MILD_QUANT_MAX = 98;

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
  heic: { quality: 90, lossless: false, chroma: '444' },
} as const;

export const PRESETS = {
  photo: {
    avif: { quality: 55, speed: 6, subsample: 1, enableSharpYUV: true, tune: AVIFTune.ssim },
    webp: { quality: 72, method: 4, use_sharp_yuv: 1 },
    jpeg: { quality: 74, progressive: true, trellis_multipass: true, trellis_opt_zero: true, trellis_opt_table: true, trellis_loops: 1, chroma_subsample: 1 },
    png: { quantMin: 58, quantMax: 78, oxipngLevel: 2 },
    heic: { quality: 55, lossless: false, chroma: '420' },
  },
  graphic: {
    avif: { quality: 56, speed: 5, subsample: 2, chromaDeltaQ: true, enableSharpYUV: true, tune: AVIFTune.ssim },
    webp: { quality: 74, method: 5, use_sharp_yuv: 1 },
    jpeg: { quality: 76, progressive: true, trellis_multipass: true, trellis_opt_zero: true, trellis_opt_table: true, trellis_loops: 1, chroma_subsample: 0 },
    png: { quantMin: 58, quantMax: 78, oxipngLevel: 4 },
    heic: { quality: 56, lossless: false, chroma: '420' },
  },
} as const;
