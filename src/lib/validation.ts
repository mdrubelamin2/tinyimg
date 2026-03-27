/**
 * File and magic-byte validation for image uploads and ZIP contents.
 * Single responsibility: validate file type and content.
 */

import {
  MAX_FILE_SIZE_BYTES,
  MAX_ZIP_FILE_SIZE_BYTES,
  getMimeType,
  DEFAULT_MIME,
  isValidImageExtension,
  ERR_FILE_EXCEEDS_LIMIT,
  ERR_INVALID_FILE,
} from '../constants';

const FILE_HEADER_READ_LENGTH = 16;

/** Magic-byte signatures for image formats (for buffer validation). */
function checkMagicBytesFromBuffer(b: Uint8Array, ext: string): boolean {
  const eq = (offset: number, arr: number[]) => arr.every((v, i) => b[offset + i] === v);
  switch (ext) {
    case 'png':
      return b.length >= 8 && eq(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'jpg':
    case 'jpeg':
      return b.length >= 3 && eq(0, [0xff, 0xd8, 0xff]);
    case 'webp':
      return b.length >= 12 && eq(0, [0x52, 0x49, 0x46, 0x46]) && eq(8, [0x57, 0x45, 0x42, 0x50]);
    case 'avif':
      return b.length >= 12 && eq(4, [0x66, 0x74, 0x79, 0x70]); // ftyp
    case 'svg':
      return b.length >= 2 && (b[0] === 0x3c || (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf));
    default:
      return false;
  }
}

/**
 * Check magic bytes from a File (reads first bytes). Reduces wrong-extension risk.
 * @param file - File to check
 * @param ext - Expected extension (e.g. 'png', 'jpg')
 * @returns true if file header matches the format
 */
export async function checkMagicBytes(file: File, ext: string): Promise<boolean> {
  const buf = await file.slice(0, FILE_HEADER_READ_LENGTH).arrayBuffer();
  return checkMagicBytesFromBuffer(new Uint8Array(buf), ext);
}

/**
 * Validate a single file: type, size, and magic bytes.
 * @param file - File to validate
 * @returns { ok: true } or { ok: false, error: string } with user-facing message
 */
export async function validateFile(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!isValidImageExtension(ext)) {
    return { ok: false, error: ERR_INVALID_FILE };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: ERR_FILE_EXCEEDS_LIMIT };
  }
  const magicOk = await checkMagicBytes(file, ext);
  if (!magicOk) {
    return { ok: false, error: ERR_INVALID_FILE };
  }
  return { ok: true };
}

/** Check if ZIP file size is within limit. */
export function validateZipSize(bytes: number): boolean {
  return bytes <= MAX_ZIP_FILE_SIZE_BYTES;
}

/**
 * Check magic bytes from a buffer (e.g. unzipped file content).
 * Used when validating ZIP contents without a File object.
 */
export function checkMagicBytesFromBufferExport(b: Uint8Array, ext: string): boolean {
  return checkMagicBytesFromBuffer(b, ext);
}

/** Get MIME type for a filename; re-export for use in ZIP handling. */
export { getMimeType, DEFAULT_MIME };

/**
 * Detect whether the current browser can likely decode HEIC/HEIF images.
 * Safari 17+ supports HEIC natively. Chrome/Firefox need WASM decoder.
 */
export function isHeicDecodeLikelySupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  return isSafari;
}
