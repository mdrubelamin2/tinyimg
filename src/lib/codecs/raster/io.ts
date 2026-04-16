import { MAX_PIXELS } from '@/constants';

export async function resizeImage(
  bitmap: ImageBitmap,
  width: number,
  height: number
): Promise<ImageData> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context for resize');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

export async function getImageData(bitmap: ImageBitmap): Promise<ImageData> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2d context');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

export function checkPixelLimit(width: number, height: number): void {
  const total = width * height;
  if (total > MAX_PIXELS || !Number.isFinite(total)) {
    throw new Error('Image dimensions too large (max 256 megapixels)');
  }
}

/** Normalize format for encoding: "jpg" -> "jpeg", "original" -> ext or webp. */
export function normalizeOutputFormat(requested: string, ext: string | undefined): string {
  if (requested === 'original') return ext === 'jpg' ? 'jpeg' : (ext ?? 'webp');
  return requested === 'jpg' ? 'jpeg' : requested;
}

/** Native zero-memory-spike base64 encoding using FileReader */
export async function toBase64(buffer: ArrayBuffer): Promise<string> {
  const blob = new Blob([buffer]);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      if (base64) resolve(base64);
      else reject(new Error('Failed to parse base64 from Data URL'));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error ?? fallback);
}
