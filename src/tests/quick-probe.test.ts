import { describe, expect, it } from 'vitest'

import { shouldQuickProbeSkip } from '@/workers/quick-probe'

describe('quick-probe', () => {
  it('skips small high-quality webp inputs', async () => {
    const skip = await shouldQuickProbeSkip({
      format: 'webp',
      originalSize: 80 * 1024,
      qualityPercent: 95,
      sourceBuffer: new ArrayBuffer(8),
    })
    expect(skip).toBe(true)
  })

  it('does not skip large files', async () => {
    const skip = await shouldQuickProbeSkip({
      format: 'webp',
      originalSize: 2 * 1024 * 1024,
      qualityPercent: 95,
      sourceBuffer: new ArrayBuffer(8),
    })
    expect(skip).toBe(false)
  })

  it('does not skip when quality is low', async () => {
    const skip = await shouldQuickProbeSkip({
      format: 'jpeg',
      originalSize: 50 * 1024,
      qualityPercent: 70,
      sourceBuffer: new ArrayBuffer(8),
    })
    expect(skip).toBe(false)
  })
})
