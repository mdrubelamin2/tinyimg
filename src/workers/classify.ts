/**
 * Content classification: photo vs graphic (for preset selection).
 * Heuristic based on color count and luminance entropy. See docs/QUALITY-RESEARCH.md.
 */

import {
  SMALL_IMAGE_PX,
  GRAPHIC_COLOR_THRESHOLD,
  GRAPHIC_ENTROPY_THRESHOLD,
  MAX_PIXELS_FOR_CLASSIFY,
  HISTOGRAM_BINS,
  LUMINANCE_R,
  LUMINANCE_G,
  LUMINANCE_B,
  SMALL_TRANSPARENT_PX,
} from '@/constants';

export type ContentPreset = 'photo' | 'graphic';

export function classifyContent(imageData: ImageData): ContentPreset {
  try {
    const { data, width, height } = imageData;
    const totalPx = width * height;
    if (totalPx < SMALL_IMAGE_PX) return 'photo';

    const step = totalPx > MAX_PIXELS_FOR_CLASSIFY ? Math.ceil(totalPx / MAX_PIXELS_FOR_CLASSIFY) : 1;
    const colorCount = new Set<number>();
    const hist: number[] = new Array(HISTOGRAM_BINS).fill(0);
    for (let i = 0; i < data.length; i += 4 * step) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const key = (r << 16) | (g << 8) | b;
      colorCount.add(key);
      const y = Math.round(LUMINANCE_R * r + LUMINANCE_G * g + LUMINANCE_B * b);
      const bin = Math.min(HISTOGRAM_BINS - 1, y);
      hist[bin] = (hist[bin] ?? 0) + 1;
    }
    const uniqueColors = colorCount.size;
    let entropy = 0;
    const sampled = totalPx > MAX_PIXELS_FOR_CLASSIFY ? Math.ceil(totalPx / step) : totalPx;
    for (let i = 0; i < HISTOGRAM_BINS; i++) {
      const p = hist[i]! / sampled;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    if (uniqueColors < GRAPHIC_COLOR_THRESHOLD && entropy < GRAPHIC_ENTROPY_THRESHOLD) return 'graphic';
    return 'photo';
  } catch {
    return 'photo';
  }
}

export function hasTransparency(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 255) return true;
  }
  return false;
}

export function isSmallAndTransparent(width: number, height: number, data: Uint8ClampedArray): boolean {
  const totalPx = width * height;
  return totalPx < SMALL_TRANSPARENT_PX && hasTransparency(data);
}
