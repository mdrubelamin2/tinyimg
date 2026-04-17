import { afterEach, describe, expect, it, vi } from 'vitest';

describe('computeOptimalWorkerCount', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caps by navigator.deviceMemory when set (Chromium)', async () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      hardwareConcurrency: 16,
      deviceMemory: 2,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      platform: 'Linux',
      maxTouchPoints: 0,
    });
    const { computeOptimalWorkerCount } = await import('@/capabilities/worker-count');
    const n = computeOptimalWorkerCount();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(10);
  });
});
