import { describe, it, expect, vi } from 'vitest';
import { encodeNativeAvif } from '../../lib/codecs/avif.native';

describe('Native AVIF Encoder', () => {
  it('throws an error if VideoEncoder is not defined', async () => {
    vi.stubGlobal('VideoEncoder', undefined);
    
    const fakeImageData = {
      data: new Uint8ClampedArray(400),
      width: 10,
      height: 10,
    } as ImageData;
    
    await expect(encodeNativeAvif(fakeImageData, { quality: 80 }))
      .rejects.toThrow('VideoEncoder is not supported');
  });
});
