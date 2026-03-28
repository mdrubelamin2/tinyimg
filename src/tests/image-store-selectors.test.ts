import { describe, expect, it } from 'vitest';
import { STATUS_PENDING } from '@/constants';
import type { ImageItem } from '@/lib/queue/types';
import { selectOrderedItems } from '@/store/image-store';

function createItem(id: string, name: string): ImageItem {
  return {
    id,
    file: new File(['x'], name, { type: 'image/png' }),
    status: STATUS_PENDING,
    progress: 0,
    originalSize: 1,
    originalFormat: 'png',
    results: {},
  };
}

describe('image-store selectors', () => {
  it('returns the same ordered items array for the same state snapshot', () => {
    const first = createItem('1', 'first.png');
    const second = createItem('2', 'second.png');
    const state = {
      items: new Map([
        [first.id, first],
        [second.id, second],
      ]),
      itemOrder: [first.id, second.id],
    } as Parameters<typeof selectOrderedItems>[0];

    const initial = selectOrderedItems(state);
    const repeated = selectOrderedItems(state);

    expect(repeated).toBe(initial);
  });

  it('returns a new ordered items array when the item order changes', () => {
    const first = createItem('1', 'first.png');
    const second = createItem('2', 'second.png');
    const initialState = {
      items: new Map([
        [first.id, first],
        [second.id, second],
      ]),
      itemOrder: [first.id, second.id],
    } as Parameters<typeof selectOrderedItems>[0];
    const reorderedState = {
      ...initialState,
      itemOrder: [second.id, first.id],
    } as Parameters<typeof selectOrderedItems>[0];

    const initial = selectOrderedItems(initialState);
    const reordered = selectOrderedItems(reorderedState);

    expect(reordered).not.toBe(initial);
    expect(reordered).toEqual([second, first]);
  });
});
