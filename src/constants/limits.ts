/**
 * Queue, file, and processing limits.
 * All numeric boundaries that gate what the app accepts and how it behaves.
 */

export const BYTES_PER_KB = 1024;

// --- File intake limits ---
export const MAX_FILE_SIZE_BYTES = 25 * BYTES_PER_KB * BYTES_PER_KB;
export const LARGE_FILE_SERIAL_THRESHOLD_BYTES = 10 * BYTES_PER_KB * BYTES_PER_KB;
/** Compressed archive (.zip) max size before intake refuses the file (toast only, no queue row). */
export const MAX_ZIP_FILE_SIZE_BYTES = 2 * BYTES_PER_KB * BYTES_PER_KB * BYTES_PER_KB;
export const MAX_ZIP_EXTRACTED_FILES = 1000;
export const MAX_ZIP_EXTRACTED_TOTAL_BYTES = MAX_ZIP_FILE_SIZE_BYTES;

// --- Download / export limits ---
export const MAX_DOWNLOAD_BYTES = 80 * BYTES_PER_KB * BYTES_PER_KB;
export const MAX_DOWNLOAD_FILES = 200;

// --- Concurrency ---
export const CONCURRENCY_MIN = Math.max(1, Math.floor((navigator.hardwareConcurrency ?? 1) / 4));
/** Desktop / laptop worker ceiling after cores + memory heuristics. */
export const CONCURRENCY_MAX_DESKTOP = Math.max(1, Math.floor((navigator.hardwareConcurrency ?? 1) / 2));
/** When `navigator.deviceMemory` is missing (Safari / Firefox), cap optimizer workers to limit decode+WASM RSS. */
export const CONCURRENCY_MAX_NO_DEVICE_MEMORY = 2;
export const MOBILE_MAX_WORKERS = 2;
/** Rough WASM footprint per worker for memory-based caps (MB). */
export const MB_PER_WORKER_ESTIMATE = 1024;
/** Reserve this many GB of reported deviceMemory before sizing workers. */
export const DEVICE_MEMORY_RESERVE_GB = 2;

// --- Worker / optimizer ---
export const MAX_PIXELS = 50_000_000;
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
export const SVG_INTERNAL_SSAA_SCALE = 4;

// --- SVG complexity / raster thresholds (extracted from SVG pipeline) ---
// Node/segment limits to decide between vector vs wrapped/rasterized paths
export const SVG_NODES_MAX = 1500;
export const SVG_SEGMENTS_MAX = 5000;
// Embedded raster size threshold used for hybrid wrapping decisions
export const SVG_RASTER_BYTES_MAX = 32768; // 32 KB
// 4KB tiny-file threshold used to skip wrapping for very small SVGs
export const SVG_TINY_FILE_BYTES_MAX = 4096;
// Node count threshold to trigger complexity-anchor wrapping when raster data exists
export const SVG_NODES_ANCHOR_MAX = 256;
// Minimum embedded raster bytes to consider hybrid wrapping as dominant
export const SVG_RASTER_BYTES_MIN_FOR_HYBRID = 4096;
// Dominance ratio threshold for hybrid determination
export const SVG_RASTER_DOMINANCE_RATIO = 0.5;

/** Max worker RESULT payloads queued for main-thread persist per RAF batch (backpressure). */
export const RESULT_PERSIST_BATCH_MAX_ITEMS = 4;
/** Max total encoded bytes per persist batch before chaining the next chunk. */
export const RESULT_PERSIST_BATCH_MAX_BYTES = 100 * BYTES_PER_KB * BYTES_PER_KB;

// --- Timing ---
export const UPDATE_OPTIONS_DEBOUNCE_MS = 300;
export const DOWNLOAD_URL_REVOKE_DELAY_MS = 10_000;

// --- ID generation ---
export const ID_RANDOM_LENGTH = 6;
