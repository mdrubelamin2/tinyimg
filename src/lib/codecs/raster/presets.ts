/**
 * Production and SVG vector presets — verbatim from historical raster-encode.ts.
 */

const AVIFTune = { auto: 0, psnr: 1, ssim: 2 } as const

export const WEBP_QUALITY_TRANSPARENT = 77
export const PNG_MILD_QUANT_MIN = 90
export const PNG_MILD_QUANT_MAX = 98

export const SVG_DISPLAY_VECTOR_PRESET = {
  avif: {
    chromaDeltaQ: true,
    enableSharpYUV: true,
    quality: 90,
    sharpness: 1,
    speed: 3,
    subsample: 0,
    tune: AVIFTune.ssim,
  },
  heic: { chroma: '444', lossless: false, quality: 90 },
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

export const PRESETS = {
  graphic: {
    avif: {
      chromaDeltaQ: true,
      enableSharpYUV: true,
      quality: 56,
      speed: 5,
      subsample: 2,
      tune: AVIFTune.ssim,
    },
    heic: { chroma: '420', lossless: false, quality: 56 },
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
    heic: { chroma: '420', lossless: false, quality: 55 },
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
