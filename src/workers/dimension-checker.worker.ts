/**
 * Dimension checker worker: checks image dimensions and magic bytes without blocking main thread
 * Uses fast header parsing to avoid decoding large images
 */

import imageSize from 'image-size';
import { MAX_PIXELS } from '@/constants';
import { detectFileTypeFromBuffer } from '@/lib/validation';

self.onmessage = async (e: MessageEvent) => {
  const { file, id } = e.data;

  try {
    // For SVG files, skip dimension check
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'svg') {
      self.postMessage({ id, valid: true });
      return;
    }

    let width: number;
    let height: number;

    // Try fast header parsing first (reads only first 128KB)
    try {
      const headerBytes = await file.slice(0, 128 * 1024).arrayBuffer();
      const headerBuffer = new Uint8Array(headerBytes);

      // Validate magic bytes using mime-bytes (fast, happens in parallel)
      const detected = await detectFileTypeFromBuffer(headerBuffer.slice(0, 4100));
      if (!detected) {
        self.postMessage({
          id,
          valid: false,
          error: 'Invalid or corrupted image file',
        });
        return;
      }

      const dimensions = imageSize(headerBuffer);

      if (dimensions.width && dimensions.height) {
        width = dimensions.width;
        height = dimensions.height;
      } else {
        throw new Error('Header parsing failed');
      }
    } catch {
      // Fallback: Use createImageBitmap (slow but reliable)
      // This only happens for malformed/unsupported files
      const bitmap = await createImageBitmap(file, {
        resizeWidth: 1,
        resizeHeight: 1,
        resizeQuality: 'pixelated',
      });
      width = bitmap.width;
      height = bitmap.height;
      bitmap.close();
    }

    const pixels = width * height;

    if (pixels > MAX_PIXELS || !Number.isFinite(pixels)) {
      self.postMessage({
        id,
        valid: false,
        error: `Image dimensions too large (${(pixels / 1_000_000).toFixed(1)}MP). Maximum supported: ${(MAX_PIXELS / 1_000_000).toFixed(0)}MP (~7K×7K)`,
      });
      return;
    }

    self.postMessage({ id, valid: true });
  } catch {
    // If we can't decode, let the optimizer worker handle it
    self.postMessage({ id, valid: true });
  }
};
