/**
 * Raster encode: bitmap to ImageData, pixel limit check, and AVIF/WebP/JPEG/PNG encoding.
 * Implementation lives in @/lib/codecs/raster; this file is the stable worker entry facade.
 */

export {
  resizeImage,
  getImageData,
  checkPixelLimit,
  normalizeOutputFormat,
  toBase64,
  toErrorMessage,
} from '@/lib/codecs/raster/io';

export { compositeImageDataOnWhite } from '@/lib/codecs/raster/composite';

export { PRESETS } from '@/lib/codecs/raster/presets';

export {
  encodeRaster,
  encodeRasterWithFallback,
} from '@/lib/codecs/raster/encode-fallback';

export { encodeRasterVectorSafe } from '@/lib/codecs/raster/vector-safe';
