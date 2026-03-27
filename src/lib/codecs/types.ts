/**
 * Codec plugin interface: defines the contract for all image encoders/decoders.
 * This abstraction allows swapping codecs (e.g., MozJPEG → Jpegli) without
 * touching the pipeline code.
 */

export type ImageFormat = 'jpeg' | 'webp' | 'avif' | 'png' | 'jxl';

export interface EncodeOptions {
  quality: number;
  [key: string]: unknown;
}

export interface CodecCapabilities {
  encode: boolean;
  decode: boolean;
  lossless: boolean;
  transparency: boolean;
  animation: boolean;
  simd: boolean;
}

export interface CodecPlugin {
  /** Unique identifier, e.g. 'mozjpeg', 'jpegli', 'libwebp' */
  readonly id: string;

  /** Output format this codec handles */
  readonly format: ImageFormat;

  /** What this codec can do */
  readonly capabilities: CodecCapabilities;

  /** Lazy-load and initialize the WASM module */
  init(): Promise<void>;

  /** Encode ImageData to a compressed ArrayBuffer */
  encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer>;

  /** Decode a compressed ArrayBuffer to ImageData (optional — not all codecs support decode) */
  decode?(data: ArrayBuffer): Promise<ImageData>;
}
