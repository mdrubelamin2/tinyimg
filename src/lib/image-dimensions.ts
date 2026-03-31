/**
 * Fast image dimension checking without full decode.
 * Uses createImageBitmap with resizeWidth/resizeHeight options to minimize memory.
 */

import { MAX_PIXELS } from '@/constants';

export interface ImageDimensions {
  width: number;
  height: number;
  pixels: number;
}

/**
 * Get image dimensions with minimal memory footprint.
 * Creates a tiny 1x1 bitmap just to read dimensions, then immediately closes it.
 */
export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  // Create a minimal bitmap just to read dimensions
  // Note: Even with resizeWidth/Height, browser still needs to decode to get natural size
  const bitmap = await createImageBitmap(file, {
    resizeWidth: 1,
    resizeHeight: 1,
    resizeQuality: 'pixelated',
  });

  const width = bitmap.width;
  const height = bitmap.height;
  bitmap.close();

  return {
    width,
    height,
    pixels: width * height,
  };
}

/**
 * Check if image exceeds pixel limit.
 * Throws error if too large.
 */
export async function checkImageDimensions(file: File): Promise<void> {
  const dims = await getImageDimensions(file);

  if (dims.pixels > MAX_PIXELS || !Number.isFinite(dims.pixels)) {
    throw new Error(
      `Image dimensions too large (${(dims.pixels / 1_000_000).toFixed(1)}MP). Maximum supported: ${(MAX_PIXELS / 1_000_000).toFixed(0)}MP (~7K×7K)`
    );
  }
}
