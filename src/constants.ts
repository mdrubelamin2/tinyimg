/**
 * Single source of truth for limits, status, formats, MIME types, and error messages.
 * No magic values in application code; all literals used by queue-processor, worker, and UI live here.
 */

// --- Queue / main thread limits ---
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_ZIP_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024;
export const MAX_DOWNLOAD_FILES = 200;
export const UPDATE_OPTIONS_DEBOUNCE_MS = 300;
export const CONCURRENCY_MIN = 2;
export const CONCURRENCY_MAX = 6;
export const CONCURRENCY_DEFAULT = 4;

// --- Worker / optimizer limits ---
export const MAX_PIXELS = 256_000_000;
export const TASK_TIMEOUT_MS = 120_000;
export const WRAPPER_SIZE_THRESHOLD = 0.95;
export const SMALL_IMAGE_PX = 10_000;
export const GRAPHIC_COLOR_THRESHOLD = 2_500;
export const GRAPHIC_ENTROPY_THRESHOLD = 6.5;
export const MAX_PIXELS_FOR_CLASSIFY = 4_000_000;
export const HISTOGRAM_BINS = 256;
/** Below this pixel count, transparent detection runs (for WebP quality tweak). */
export const SMALL_TRANSPARENT_PX = 800_000;

// --- Luminance weights (BT.601) for classification ---
export const LUMINANCE_R = 0.299;
export const LUMINANCE_G = 0.587;
export const LUMINANCE_B = 0.114;

// --- Status strings (single source for types and UI) ---
export const STATUS_CHECKING = 'checking' as const;
export const STATUS_PENDING = 'pending' as const;
export const STATUS_PROCESSING = 'processing' as const;
export const STATUS_SUCCESS = 'success' as const;
export const STATUS_ERROR = 'error' as const;

export type ItemStatus = typeof STATUS_CHECKING | typeof STATUS_PENDING | typeof STATUS_PROCESSING | typeof STATUS_SUCCESS | typeof STATUS_ERROR;
export const ITEM_STATUSES: readonly ItemStatus[] = [STATUS_CHECKING, STATUS_PENDING, STATUS_PROCESSING, STATUS_SUCCESS, STATUS_ERROR];

// --- Output formats ---
export type OutputFormat = 'original' | 'webp' | 'avif' | 'jpeg' | 'png' | 'svg' | 'jxl';
export type SvgInternalFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'jxl';

export const SUPPORTED_FORMATS: readonly string[] = ['webp', 'avif', 'jpeg', 'png', 'jxl'];
export const SVG_INTERNAL_FORMATS: readonly SvgInternalFormat[] = ['webp', 'avif', 'jpeg', 'png', 'jxl'];

// --- Quality/resize limits (internal processing, not user-configurable) ---
export const OUTPUT_QUALITY_MIN = 1;
export const OUTPUT_QUALITY_MAX = 100;
export const RESIZE_MAX_EDGE_MIN = 0;
export const RESIZE_MAX_EDGE_MAX = 16384;

// --- SVG raster quality policy (worker) ---
/** Fixed internal SSAA scale for SVG rasterization (final output dimensions remain unchanged). */
export const SVG_INTERNAL_SSAA_SCALE = 4;
export const SVG_DOWNSCALE_QUALITY = 3;
export const SVG_DOWNSCALE_UNSHARP_AMOUNT = 160;
export const SVG_DOWNSCALE_UNSHARP_RADIUS = 0.6;
export const SVG_DOWNSCALE_UNSHARP_THRESHOLD = 1;

/** If lossless output exceeds lossy output by more than this ratio, fall back to lossy. */
export const LOSSLESS_SIZE_GUARD_RATIO = 1.3;

// --- MIME map (format/extension → MIME) ---
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

// --- Error messages (user-facing; used by queue-processor and worker) ---
export const ERR_FILE_EXCEEDS_LIMIT = 'File exceeds 25MB limit';
export const ERR_ZIP_EXCEEDS_LIMIT = 'ZIP exceeds 25MB limit';
export const ERR_INVALID_FILE = 'Invalid or unsupported file content';
export const ERR_WORKER = 'Worker error';
export const ERR_TASK_TIMEOUT = 'Task timed out';
export const ERR_CANCELLED = 'Cancelled';
export const ERR_HEIC_BROWSER =
  'HEIC/HEIF is not supported in this browser. Use Safari or convert to JPEG/PNG first.';
export const ERR_TIFF_DECODE =
  'TIFF could not be decoded in this browser. Try converting to PNG or JPEG.';

// --- Default global options (single definition; used by queue-processor and ConfigPanel) ---
export interface GlobalOptions {
  formats: string[];
  useOriginalFormats: boolean;
  /** When Custom mode: include the file's original format in output (e.g. PNG file → also output PNG). Deduped with other selected formats. */
  includeOriginalInCustom: boolean;
  /** When true, pending queue runs smaller files first for faster perceived batch completion. */
  smallFilesFirst: boolean;
  /** Documented preference; raster re-encode from pixels already drops EXIF. Reserved for SVG metadata policy. */
  stripMetadata: boolean;
  svgInternalFormat: SvgInternalFormat;
}

export const DEFAULT_GLOBAL_OPTIONS: GlobalOptions = {
  formats: [],
  useOriginalFormats: true,
  includeOriginalInCustom: false,
  smallFilesFirst: true,
  stripMetadata: true,
  svgInternalFormat: 'webp',
};

// --- ID generation (random segment length for createItem) ---
export const ID_RANDOM_LENGTH = 9;

// --- Download ZIP: revoke object URL after delay (allow save to complete) ---
export const DOWNLOAD_URL_REVOKE_DELAY_MS = 10000;

// --- UI / display ---
export const BYTES_PER_KB = 1024;

// --- Confetti (success celebration) ---
export const CONFETTI_PARTICLE_COUNT = 150;
export const CONFETTI_SPREAD = 100;
export const CONFETTI_ORIGIN_Y = 0.6;
export const CONFETTI_COLORS = ['#0369A1', '#0F172A', '#334155'] as const;

// --- Valid file extensions for upload ---
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
] as const;

export function isValidImageExtension(ext: string): boolean {
  return VALID_IMAGE_EXTENSIONS.includes(ext as (typeof VALID_IMAGE_EXTENSIONS)[number]);
}
