/**
 * Image format types, MIME mappings, and valid extensions.
 * Single source of truth for what formats the app understands.
 */

// --- Status strings (used as type discriminants and UI labels) ---
export const STATUS_PENDING = 'pending' as const
export const STATUS_PROCESSING = 'processing' as const
export const STATUS_SUCCESS = 'success' as const
export const STATUS_ERROR = 'error' as const

export type ItemStatus =
  | typeof STATUS_ERROR
  | typeof STATUS_PENDING
  | typeof STATUS_PROCESSING
  | typeof STATUS_SUCCESS

// --- Output format types ---
export type OutputFormat =
  | 'avif'
  | 'heic'
  | 'heif'
  | 'jpeg'
  | 'jxl'
  | 'original'
  | 'png'
  | 'svg'
  | 'webp'
export type RasterFormat = 'avif' | 'heic' | 'heif' | 'jpeg' | 'png' | 'webp'
export type SvgExportDensity = 'display' | 'legacy'
export type SvgInternalFormat = 'avif' | 'heic' | 'heif' | 'jpeg' | 'jxl' | 'png' | 'webp'
export type SvgRasterizer = 'auto' | 'browser' | 'resvg'

export const SUPPORTED_FORMATS: readonly string[] = ['webp', 'avif', 'jpeg', 'png', 'heic', 'heif']
export const SVG_INTERNAL_FORMATS: readonly SvgInternalFormat[] = [
  'webp',
  'avif',
  'jpeg',
  'png',
  'heic',
  'heif',
]
export const RASTER_FORMATS: readonly RasterFormat[] = [
  'webp',
  'avif',
  'jpeg',
  'png',
  'heic',
  'heif',
]
export const SVG_RASTERIZERS: readonly SvgRasterizer[] = ['auto', 'browser', 'resvg']
export const SVG_EXPORT_DENSITIES: readonly SvgExportDensity[] = ['legacy', 'display']

// --- MIME mapping ---
const MIME_BY_EXT: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  jxl: 'image/jxl',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
}

export const DEFAULT_MIME = 'application/octet-stream'

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  return (ext && MIME_BY_EXT[ext]) || DEFAULT_MIME
}

export function mimeByFormat(format: string): string {
  return `image/${format === 'jpeg' ? 'jpeg' : format}`
}

/**
 * MIME type for `Blob` / object URLs for queue result formats (batch ZIP and hybrid storage).
 * Differs from {@link mimeByFormat} for e.g. `svg` (`image/svg+xml` vs `image/svg`).
 */
export function mimeForOutputFormat(format: string): string {
  if (format === 'jpeg' || format === 'jpg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  if (format === 'webp') return 'image/webp'
  if (format === 'avif') return 'image/avif'
  if (format === 'svg') return 'image/svg+xml'
  if (format === 'jxl') return 'image/jxl'
  if (format === 'heic') return 'image/heic'
  if (format === 'heif') return 'image/heif'
  return 'application/octet-stream'
}

// --- Valid upload extensions ---
export const VALID_IMAGE_EXTENSIONS = [
  'svg',
  'png',
  'webp',
  'avif',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'tif',
  'tiff',
  'heic',
  'heif',
] as const

export function isValidImageExtension(ext: string): boolean {
  return VALID_IMAGE_EXTENSIONS.includes(ext as (typeof VALID_IMAGE_EXTENSIONS)[number])
}
