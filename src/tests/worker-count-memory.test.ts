import { afterEach, describe, expect, it, vi } from 'vitest';

describe('computeOptimalWorkerCount', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      innerWidth: 1920,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caps by navigator.deviceMemory when set (Chromium)', async () => {
    vi.resetModules();
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

  it('caps concurrent workers when navigator.deviceMemory is missing (Safari / Firefox)', async () => {
    vi.resetModules();
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      hardwareConcurrency: 16,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    });
    const { computeOptimalWorkerCount } = await import('@/capabilities/worker-count');
    const n = computeOptimalWorkerCount();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(4);
  });
});
