import { describe, expect, it } from 'vitest';
import { DEFAULT_GLOBAL_OPTIONS, STATUS_PENDING } from '@/constants';
import type { ImageItem } from '@/lib/queue/types';
import { buildOutputSlots } from '@/lib/queue/output-slots';

function baseItem(over: Partial<ImageItem> = {}): ImageItem {
  return {
    id: 'i1',
    fileName: 'x.png',
    mimeType: 'image/png',
    originalSourceKind: 'direct',
    status: STATUS_PENDING,
    progress: 0,
    originalSize: 100,
    originalFormat: 'png',
    results: {},
    ...over,
  };
}

describe('buildOutputSlots', () => {
  it('uses format as resultId when useOriginalSizes', () => {
    const item = baseItem();
    const opts = {
      ...DEFAULT_GLOBAL_OPTIONS,
      useOriginalFormats: false,
      formats: ['webp'],
      useOriginalSizes: true,
    };
    const slots = buildOutputSlots(item, opts);
    expect(slots.map((s) => s.resultId)).toEqual(['webp']);
    expect(slots[0]?.resizePreset).toEqual({ kind: 'native' });
  });

  it('builds cartesian product for custom sizes', () => {
    const item = baseItem();
    const opts = {
      ...DEFAULT_GLOBAL_OPTIONS,
      useOriginalFormats: false,
      formats: ['webp', 'avif'],
      useOriginalSizes: false,
      includeNativeSizeInCustom: false,
      customSizePresets: [
        { id: 'a', width: 400, height: 0, maintainAspect: true },
        { id: 'b', width: 800, height: 600, maintainAspect: false },
      ],
    };
    const slots = buildOutputSlots(item, opts);
    expect(slots.map((s) => s.resultId)).toEqual([
      'webp__w400',
      'webp__800x600',
      'avif__w400',
      'avif__800x600',
    ]);
  });

  it('collapses vector SVG to a single svg slot', () => {
    const item = baseItem({ originalFormat: 'svg', fileName: 'a.svg' });
    const opts = {
      ...DEFAULT_GLOBAL_OPTIONS,
      useOriginalFormats: false,
      formats: ['svg', 'webp'],
      useOriginalSizes: false,
      customSizePresets: [{ id: 'a', width: 100, height: 0, maintainAspect: true }],
    };
    const slots = buildOutputSlots(item, opts);
    const svgSlots = slots.filter((s) => s.format === 'svg');
    expect(svgSlots).toHaveLength(1);
    expect(svgSlots[0]?.resultId).toBe('svg');
    expect(slots.filter((s) => s.format === 'webp').map((s) => s.resultId)).toEqual(['webp__w100']);
  });
});
