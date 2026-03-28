import { describe, it, expect, vi } from 'vitest';
import { initGpuDevice, isGpuAvailable } from '../../lib/gpu/gpu-device';

describe('GPU Device', () => {
  it('returns false when navigator.gpu is undefined', async () => {
    vi.stubGlobal('navigator', { gpu: undefined });
    const available = await isGpuAvailable();
    expect(available).toBe(false);
  });

  it('returns device when GPU is available', async () => {
    const mockAdapter = {
      requestDevice: vi.fn().mockResolvedValue({
        limits: {
          maxTextureDimension2D: 16384,
          maxComputeWorkgroupStorageSize: 32768,
        },
      }),
    };
    vi.stubGlobal('navigator', { gpu: { requestAdapter: vi.fn().mockResolvedValue(mockAdapter) } });
    
    const device = await initGpuDevice();
    expect(device).toBeDefined();
  });
});
