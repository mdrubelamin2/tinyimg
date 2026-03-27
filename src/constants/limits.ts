/**
 * Queue, file, and processing limits.
 * All numeric boundaries that gate what the app accepts and how it behaves.
 */

// --- File intake limits ---
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_ZIP_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_ZIP_EXTRACTED_FILES = 1000;
export const MAX_ZIP_EXTRACTED_TOTAL_BYTES = 200 * 1024 * 1024;

// --- Download / export limits ---
export const MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024;
export const MAX_DOWNLOAD_FILES = 200;

// --- Concurrency ---
export const CONCURRENCY_MIN = 2;
export const CONCURRENCY_MAX = 6;
export const CONCURRENCY_DEFAULT = 4;

// --- Worker / optimizer ---
export const MAX_PIXELS = 256_000_000;
export const TASK_TIMEOUT_MS = 120_000;

// --- Quality slider range ---
export const OUTPUT_QUALITY_MIN = 1;
export const OUTPUT_QUALITY_MAX = 100;
export const OUTPUT_QUALITY_DEFAULT = 100;

// --- Resize range ---
export const RESIZE_MAX_EDGE_MIN = 0;
export const RESIZE_MAX_EDGE_MAX = 16384;

// --- SVG raster config ---
export const SVG_DISPLAY_DPR_DEFAULT = 2;
export const SVG_DISPLAY_DPR_MIN = 1;
export const SVG_DISPLAY_DPR_MAX = 3;
export const SVG_INTERNAL_SSAA_SCALE = 4;
export const SVG_DOWNSCALE_QUALITY = 3;
export const SVG_DOWNSCALE_UNSHARP_AMOUNT = 160;
export const SVG_DOWNSCALE_UNSHARP_RADIUS = 0.6;
export const SVG_DOWNSCALE_UNSHARP_THRESHOLD = 1;

// --- Timing ---
export const UPDATE_OPTIONS_DEBOUNCE_MS = 300;
export const DOWNLOAD_URL_REVOKE_DELAY_MS = 10_000;

// --- ID generation ---
export const ID_RANDOM_LENGTH = 9;
