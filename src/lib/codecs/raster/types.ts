/**
 * Raster encode preset shape (matches historical raster-encode.ts interface).
 */

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

export interface EncodeResult {
  data: ArrayBuffer;
  lossless: boolean;
}
