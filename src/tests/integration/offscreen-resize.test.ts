import { describe, it, expect, vi } from 'vitest';
import { resizeImage } from '../../workers/raster-encode';

describe('resizeImage (OffscreenCanvas path)', () => {
  it('resizes via OffscreenCanvas when navigator.gpu is unavailable', async () => {
    vi.stubGlobal('navigator', { gpu: undefined });
    vi.stubGlobal('OffscreenCanvas', class OffscreenCanvas {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      getContext() {
        return {
          drawImage: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(this.width * this.height * 4), width: this.width, height: this.height }),
        };
      }
    });

    const mockBitmap = {
      width: 100,
      height: 100,
    } as ImageBitmap;

    const result = await resizeImage(mockBitmap, 50, 50);
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
  });
});
