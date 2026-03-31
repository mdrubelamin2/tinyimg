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
} from '@/constants';
import { fileTypeFromBuffer } from 'file-type';

const FILE_HEADER_READ_LENGTH = 4100; // file-type recommends 4100 bytes for accurate detection

/**
 * Detect file type from buffer using file-type library.
 * Returns detected extension and mime type, or null if unknown.
 */
export async function detectFileTypeFromBuffer(buffer: Uint8Array): Promise<{ ext: string; mime: string } | null> {
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return null;
  }

  return {
    ext: detected.ext,
    mime: detected.mime,
  };
}

/**
 * Legacy function for backward compatibility with zip-extractor.worker.ts
 * Checks if buffer matches expected extension using mime-bytes.
 * @deprecated Use detectFileTypeFromBuffer instead
 */
export async function checkMagicBytesFromBuffer(buffer: Uint8Array, expectedExt: string): Promise<boolean> {
  const detected = await detectFileTypeFromBuffer(buffer);
  if (!detected) return false;

  // Check if detected extension matches expected (normalize jpeg/jpg)
  const normalizedExpected = expectedExt === 'jpeg' ? 'jpg' : expectedExt;
  const normalizedDetected = detected.ext === 'jpeg' ? 'jpg' : detected.ext;

  return normalizedDetected === normalizedExpected;
}

/**
 * Check magic bytes from a File (reads first bytes). Reduces wrong-extension risk.
 * @param file - File to check
 * @returns detected file type or null if unknown
 */
export async function checkMagicBytes(file: File): Promise<{ ext: string; mime: string } | null> {
  const buf = await file.slice(0, FILE_HEADER_READ_LENGTH).arrayBuffer();
  return detectFileTypeFromBuffer(new Uint8Array(buf));
}

/**
 * Validate a single file: type, size, and magic bytes.
 * @param file - File to validate
 * @returns { ok: true } or { ok: false, error: string } with user-facing message
 */
export async function validateFile(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: ERR_FILE_EXCEEDS_LIMIT };
  }

  // Detect actual file type from magic bytes
  const detected = await checkMagicBytes(file);
  if (!detected || !isValidImageExtension(detected.ext)) {
    return { ok: false, error: ERR_INVALID_FILE };
  }

  return { ok: true };
}

/** Check if ZIP file size is within limit. */
export function validateZipSize(bytes: number): boolean {
  return bytes <= MAX_ZIP_FILE_SIZE_BYTES;
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
