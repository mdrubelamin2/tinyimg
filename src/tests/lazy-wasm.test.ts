import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureResvg = vi.fn().mockResolvedValue(undefined)
const ensureQuant = vi.fn().mockResolvedValue(undefined)
const ensureHeicDecoder = vi.fn().mockResolvedValue(undefined)
const ensureHeicEncoder = vi.fn().mockResolvedValue(undefined)

vi.mock('@/workers/optimizer-wasm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/workers/optimizer-wasm')>()
  return {
    ...actual,
    ensureHeicDecoder,
    ensureHeicEncoder,
    ensureQuant,
    ensureResvg,
  }
})

import { encodeWebpWithPreset } from '@/lib/codecs/raster/encode-webp'
import { PRESETS } from '@/lib/codecs/raster/presets'

describe('lazy WASM loading', () => {
  beforeEach(() => {
    ensureResvg.mockClear()
    ensureQuant.mockClear()
    ensureHeicDecoder.mockClear()
    ensureHeicEncoder.mockClear()
  })

  it('webp encode path does not load Resvg or HEIC WASM', async () => {
    const imageData = new ImageData(4, 4)
    try {
      await encodeWebpWithPreset(imageData, PRESETS.photo, false, false)
    } catch {
      // WASM may be unavailable in test env; we only assert ensure* was not called.
    }
    expect(ensureResvg).not.toHaveBeenCalled()
    expect(ensureHeicDecoder).not.toHaveBeenCalled()
    expect(ensureHeicEncoder).not.toHaveBeenCalled()
  })
})
