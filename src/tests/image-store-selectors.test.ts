import { describe, expect, it } from 'vitest'

import type { ImageItem } from '@/lib/queue/types'

import { STATUS_PENDING } from '@/constants'
import { selectOrderedItems } from '@/store/image-store'

function createItem(id: string, name: string): ImageItem {
  return {
    fileName: name,
    id,
    mimeType: 'image/png',
    originalFormat: 'png',
    originalSize: 1,
    originalSourceKind: 'direct',
    progress: 0,
    results: {},
    status: STATUS_PENDING,
  }
}

describe('image-store selectors', () => {
  it('returns the same ordered items array for the same state snapshot', () => {
    const first = createItem('1', 'first.png')
    const second = createItem('2', 'second.png')
    const state = {
      itemOrder: [first.id, second.id],
      items: new Map([
        [first.id, first],
        [second.id, second],
      ]),
    } as Parameters<typeof selectOrderedItems>[0]

    const initial = selectOrderedItems(state)
    const repeated = selectOrderedItems(state)

    expect(repeated).toEqual(initial)
  })

  it('returns a new ordered items array when the item order changes', () => {
    const first = createItem('1', 'first.png')
    const second = createItem('2', 'second.png')
    const initialState = {
      itemOrder: [first.id, second.id],
      items: new Map([
        [first.id, first],
        [second.id, second],
      ]),
    } as Parameters<typeof selectOrderedItems>[0]
    const reorderedState = {
      ...initialState,
      itemOrder: [second.id, first.id],
    } as Parameters<typeof selectOrderedItems>[0]

    const initial = selectOrderedItems(initialState)
    const reordered = selectOrderedItems(reorderedState)

    expect(reordered).not.toBe(initial)
    expect(reordered).toEqual([second, first])
  })
})
