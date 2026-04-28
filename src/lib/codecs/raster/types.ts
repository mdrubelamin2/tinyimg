/**
 * Raster encode preset shape (matches historical raster-encode.ts interface).
 */

export type AllRasterFormat = 'heic' | 'heif' | RasterFormat

export interface EncodeResult {
  data: ArrayBuffer
  lossless: boolean
}

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
  heic: {
    chroma: '420' | '422' | '444'
    lossless?: boolean
    quality: number
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

export type RasterFormat = 'avif' | 'jpeg' | 'png' | 'webp'
