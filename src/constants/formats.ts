/**
 * Image format types, MIME mappings, and valid extensions.
 * Single source of truth for what formats the app understands.
 */

// --- Status strings (used as type discriminants and UI labels) ---
export const STATUS_CHECKING = 'checking' as const;
export const STATUS_PENDING = 'pending' as const;
export const STATUS_PROCESSING = 'processing' as const;
export const STATUS_SUCCESS = 'success' as const;
export const STATUS_ERROR = 'error' as const;

export type ItemStatus =
  | typeof STATUS_CHECKING
  | typeof STATUS_PENDING
  | typeof STATUS_PROCESSING
  | typeof STATUS_SUCCESS
  | typeof STATUS_ERROR;

// --- Output format types ---
export type OutputFormat = 'original' | 'webp' | 'avif' | 'jpeg' | 'png' | 'svg' | 'jxl';
export type SvgInternalFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'jxl';
export type SvgRasterizer = 'auto' | 'browser' | 'resvg';
export type SvgExportDensity = 'legacy' | 'display';
export type RasterFormat = 'webp' | 'avif' | 'jpeg' | 'png';

export const SUPPORTED_FORMATS: readonly string[] = ['webp', 'avif', 'jpeg', 'png'];
export const SVG_INTERNAL_FORMATS: readonly SvgInternalFormat[] = ['webp', 'avif', 'jpeg', 'png'];
export const RASTER_FORMATS: readonly RasterFormat[] = ['webp', 'avif', 'jpeg', 'png'];
export const SVG_RASTERIZERS: readonly SvgRasterizer[] = ['auto', 'browser', 'resvg'];
export const SVG_EXPORT_DENSITIES: readonly SvgExportDensity[] = ['legacy', 'display'];

// --- MIME mapping ---
const MIME_BY_EXT: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jxl: 'image/jxl',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
};

export const DEFAULT_MIME = 'application/octet-stream';

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return (ext && MIME_BY_EXT[ext]) || DEFAULT_MIME;
}

export function mimeByFormat(format: string): string {
  return `image/${format === 'jpeg' ? 'jpeg' : format}`;
}

// --- Valid upload extensions ---
export const VALID_IMAGE_EXTENSIONS = [
  'svg', 'png', 'webp', 'avif', 'jpg', 'jpeg',
  'gif', 'bmp', 'tif', 'tiff', 'heic', 'heif',
] as const;

export function isValidImageExtension(ext: string): boolean {
  return VALID_IMAGE_EXTENSIONS.includes(ext as (typeof VALID_IMAGE_EXTENSIONS)[number]);
}
