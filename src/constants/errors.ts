/**
 * User-facing error messages and error codes.
 * All string literals for error states live here — no magic strings in app code.
 */

// --- User-facing error messages ---
export const ERR_FILE_EXCEEDS_LIMIT = 'File exceeds 25MB limit'
export const ERR_ZIP_EXCEEDS_LIMIT = 'ZIP exceeds 2GB limit'
export const ERR_INTAKE_STORAGE_FULL =
  'Could not save files: browser storage is full. Clear the queue or download results, then try again.'
export const ERR_PERSIST_STORAGE_FULL =
  'Could not save optimized output: browser storage is full. Free space (clear finished items or download results), then retry.'
export const ERR_PERSIST_FAILED = 'Could not save optimized output.'
export const ERR_INVALID_FILE = 'Invalid or unsupported file content'
export const ERR_WORKER = 'Worker error'
export const ERR_TASK_TIMEOUT = 'Task timed out'
export const ERR_CANCELLED = 'Cancelled'
export const ERR_HEIC_BROWSER =
  'HEIC/HEIF is not supported in this browser. Use Safari or convert to JPEG/PNG first.'
export const ERR_TIFF_DECODE =
  'TIFF could not be decoded in this browser. Try converting to PNG or JPEG.'

// --- Programmatic error codes ---
export type ErrorCode =
  | 'CANCELLED'
  | 'DECODE_FAILED'
  | 'ENCODE_FAILED'
  | 'PIXEL_LIMIT'
  | 'SVG_RASTER_FAILED'
  | 'TASK_TIMEOUT'
  | 'VALIDATION_FILE_LIMIT'
  | 'VALIDATION_INVALID_FILE'
  | 'VALIDATION_ZIP_LIMIT'
  | 'WORKER_ERROR'
