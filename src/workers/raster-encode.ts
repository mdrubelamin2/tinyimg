/**
 * Raster encode: bitmap to ImageData, pixel limit check, and AVIF/WebP/JPEG/PNG encoding.
 * Implementation lives in @/lib/codecs/raster; this file is the stable worker entry facade.
 */

export { compositeImageDataOnWhite } from '@/lib/codecs/raster/composite'
export { encodeRaster, encodeRasterWithFallback } from '@/lib/codecs/raster/encode-fallback'
export {
  checkPixelLimit,
  getImageData,
  normalizeOutputFormat,
  resizeImage,
  toBase64,
  toErrorMessage,
} from '@/lib/codecs/raster/io'
export { PRESETS } from '@/lib/codecs/raster/presets'
