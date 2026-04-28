import { describe, expect, it } from 'vitest'

import { shouldUseLosslessRasterEncode } from '@/lib/codecs/raster/output-encode'

describe('shouldUseLosslessRasterEncode', () => {
  const native = { kind: 'native' as const }
  const target = {
    height: 0,
    kind: 'target' as const,
    maintainAspect: true,
    width: 800,
  }

  it('returns false for none', () => {
    expect(shouldUseLosslessRasterEncode('none', native)).toBe(false)
    expect(shouldUseLosslessRasterEncode('none', target)).toBe(false)
  })

  it('returns true for all', () => {
    expect(shouldUseLosslessRasterEncode('all', native)).toBe(true)
    expect(shouldUseLosslessRasterEncode('all', target)).toBe(true)
  })

  it('returns true for custom_sizes_only only when target', () => {
    expect(shouldUseLosslessRasterEncode('custom_sizes_only', native)).toBe(false)
    expect(shouldUseLosslessRasterEncode('custom_sizes_only', target)).toBe(true)
  })
})
