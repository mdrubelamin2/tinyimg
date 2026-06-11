import { describe, expect, it } from 'vitest'

import { shouldQuickProbeSkip } from '@/workers/quick-probe'

const WEBP_MAGIC = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
])

const AVIF_MAGIC = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
])

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('quick-probe', () => {
  it('skips small high-quality webp inputs', async () => {
    const skip = await shouldQuickProbeSkip({
      format: 'webp',
      originalSize: 80 * 1024,
      qualityPercent: 95,
      sourceBuffer: WEBP_MAGIC.buffer,
    })
    expect(skip).toBe(true)
  })

  it('does not skip large files', async () => {
    const skip = await shouldQuickProbeSkip({
      format: 'webp',
      originalSize: 2 * 1024 * 1024,
      qualityPercent: 95,
      sourceBuffer: WEBP_MAGIC.buffer,
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

  it('skips avif when input is already avif', async () => {
    const skip = await shouldQuickProbeSkip({
      format: 'avif',
      originalSize: 2 * 1024 * 1024,
      qualityPercent: 70,
      sourceBuffer: AVIF_MAGIC.buffer,
    })
    expect(skip).toBe(true)
  })

  it('skips small lossless png inputs', async () => {
    const skip = await shouldQuickProbeSkip({
      format: 'png',
      losslessEncoding: 'all',
      originalSize: 50 * 1024,
      qualityPercent: 80,
      sourceBuffer: PNG_MAGIC.buffer,
    })
    expect(skip).toBe(true)
  })
})
