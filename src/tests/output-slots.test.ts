import { describe, expect, it } from 'vitest'

import type { ImageItem } from '@/lib/queue/types'

import { DEFAULT_GLOBAL_OPTIONS, STATUS_PENDING } from '@/constants'
import { buildOutputSlots } from '@/lib/queue/output-slots'

function baseItem(over: Partial<ImageItem> = {}): ImageItem {
  return {
    fileName: 'x.png',
    id: 'i1',
    mimeType: 'image/png',
    originalFormat: 'png',
    originalSize: 100,
    originalSourceKind: 'direct',
    progress: 0,
    results: {},
    status: STATUS_PENDING,
    ...over,
  }
}

describe('buildOutputSlots', () => {
  it('uses format as resultId when useOriginalSizes', () => {
    const item = baseItem()
    const opts = {
      ...DEFAULT_GLOBAL_OPTIONS,
      formats: ['webp'],
      useOriginalFormats: false,
      useOriginalSizes: true,
    }
    const slots = buildOutputSlots(item, opts)
    expect(slots.map((s) => s.resultId)).toEqual(['webp'])
    expect(slots[0]?.resizePreset).toEqual({ kind: 'native' })
  })

  it('builds cartesian product for custom sizes', () => {
    const item = baseItem()
    const opts = {
      ...DEFAULT_GLOBAL_OPTIONS,
      customSizePresets: [
        { height: 0, id: 'a', maintainAspect: true, width: 400 },
        { height: 600, id: 'b', maintainAspect: false, width: 800 },
      ],
      formats: ['webp', 'avif'],
      includeNativeSizeInCustom: false,
      useOriginalFormats: false,
      useOriginalSizes: false,
    }
    const slots = buildOutputSlots(item, opts)
    expect(slots.map((s) => s.resultId)).toEqual([
      'webp__w400',
      'webp__800x600',
      'avif__w400',
      'avif__800x600',
    ])
  })

  it('collapses vector SVG to a single svg slot', () => {
    const item = baseItem({ fileName: 'a.svg', originalFormat: 'svg' })
    const opts = {
      ...DEFAULT_GLOBAL_OPTIONS,
      customSizePresets: [{ height: 0, id: 'a', maintainAspect: true, width: 100 }],
      formats: ['svg', 'webp'],
      useOriginalFormats: false,
      useOriginalSizes: false,
    }
    const slots = buildOutputSlots(item, opts)
    const svgSlots = slots.filter((s) => s.format === 'svg')
    expect(svgSlots).toHaveLength(1)
    expect(svgSlots[0]?.resultId).toBe('svg')
    expect(slots.filter((s) => s.format === 'webp').map((s) => s.resultId)).toEqual(['webp__w100'])
  })
})
