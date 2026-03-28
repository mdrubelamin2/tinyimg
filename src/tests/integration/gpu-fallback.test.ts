import { describe, it, expect, vi } from 'vitest';
import { resizeImage } from '../../workers/raster-encode';

describe('GPU Fallback', () => {
  it('falls back to CPU when GPU is unavailable', async () => {
    vi.stubGlobal('navigator', { gpu: undefined });
    
    const mockBitmap = {
      width: 100,
      height: 100,
    } as ImageBitmap;
    
    const result = await resizeImage(mockBitmap, 50, 50);
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
  });
});
