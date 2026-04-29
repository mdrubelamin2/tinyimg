import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('computeOptimalWorkerCount', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      innerWidth: 1920,
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('caps by navigator.deviceMemory when set (Chromium)', async () => {
    vi.resetModules()
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      deviceMemory: 2,
      hardwareConcurrency: 16,
      maxTouchPoints: 0,
      platform: 'Linux',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    })
    const { computeOptimalWorkerCount } = await import('@/capabilities/worker-count')
    const n = computeOptimalWorkerCount()
    expect(n).toBeGreaterThanOrEqual(1)
    expect(n).toBeLessThanOrEqual(10)
  })

  it('caps concurrent workers when navigator.deviceMemory is missing (Safari / Firefox)', async () => {
    vi.resetModules()
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      hardwareConcurrency: 16,
      maxTouchPoints: 0,
      platform: 'MacIntel',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    })
    const { computeOptimalWorkerCount } = await import('@/capabilities/worker-count')
    const n = computeOptimalWorkerCount()
    expect(n).toBeGreaterThanOrEqual(1)
    expect(n).toBeLessThanOrEqual(4)
  })
})
