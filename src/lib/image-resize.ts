/**
 * Image resizing utilities using @jsquash/resize
 * High-quality WASM-based resizing with Lanczos3 filtering
 */

import resize from '@jsquash/resize';

export interface ResizeOptions {
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
  method?: 'lanczos3' | 'mitchell' | 'catrom' | 'triangle';
  fitMethod?: 'stretch' | 'contain';
  premultiply?: boolean;
  linearRGB?: boolean;
}

/**
 * Resize an ImageData using high-quality WASM algorithms
 */
export async function resizeImage(
  imageData: ImageData,
  options: ResizeOptions
): Promise<ImageData> {
  const { width, height, maxWidth, maxHeight, method = 'lanczos3', fitMethod = 'contain' } = options;

  let targetWidth = width;
  let targetHeight = height;

  // Calculate dimensions if using max constraints
  if (!targetWidth || !targetHeight) {
    const scale = Math.min(
      maxWidth ? maxWidth / imageData.width : 1,
      maxHeight ? maxHeight / imageData.height : 1,
      1 // Don't upscale
    );

    targetWidth = Math.floor(imageData.width * scale);
    targetHeight = Math.floor(imageData.height * scale);
  }

  // Use @jsquash/resize for high-quality resizing
  return resize(imageData, {
    width: targetWidth,
    height: targetHeight,
    method,
    fitMethod,
    premultiply: options.premultiply ?? true,
    linearRGB: options.linearRGB ?? false,
  });
}

/**
 * Create a thumbnail from an image blob
 */
export async function createThumbnail(
  blob: Blob,
  maxSize = 40
): Promise<Blob> {
  // Decode image
  const img = await createImageBitmap(blob);

  // Get ImageData
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  img.close();

  // Resize using high-quality algorithm
  const resized = await resizeImage(imageData, {
    maxWidth: maxSize,
    maxHeight: maxSize,
    method: 'lanczos3',
  });

  // Convert back to blob
  const outputCanvas = new OffscreenCanvas(resized.width, resized.height);
  const outputCtx = outputCanvas.getContext('2d');
  if (!outputCtx) {
    throw new Error('Failed to get output canvas context');
  }

  outputCtx.putImageData(resized, 0, 0);
  return outputCanvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
}

/**
 * Resize image for display (e.g., preview)
 */
export async function resizeForDisplay(
  imageData: ImageData,
  maxWidth: number,
  maxHeight: number
): Promise<ImageData> {
  return resizeImage(imageData, {
    maxWidth,
    maxHeight,
    method: 'lanczos3',
    fitMethod: 'contain',
  });
}
