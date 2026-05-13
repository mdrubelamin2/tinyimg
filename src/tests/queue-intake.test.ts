import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageItem } from '@/lib/queue/types'

import {
  collectItemsFromFiles,
  intakeEntriesToItems,
  type IntakeOriginalKind,
  normalizeIntakeSources,
  snapshotDataTransferItemsAsync,
} from '@/lib/queue/queue-intake'

class MockDataTransferItemList {
  [index: number]: DataTransferItem

  get length() {
    return this.items.length
  }

  private readonly items: DataTransferItem[]

  constructor(items: DataTransferItem[]) {
    this.items = items
  }

  item(index: number) {
    return this.items[index] ?? null
  }

  prime() {
    for (let i = 0; i < this.items.length; i++) {
      this[i] = this.items[i]!
    }
  }
}

function createFileEntry(file: File): FileSystemFileEntry {
  return {
    file: (callback: FileCallback) => {
      queueMicrotask(() => callback(file))
    },
    filesystem: {} as FileSystem,
    fullPath: `/${file.name}`,
    getParent: () => {},
    isDirectory: false,
    isFile: true,
    name: file.name,
  } as FileSystemFileEntry
}

function createItem(file: File, intakeKind: IntakeOriginalKind): ImageItem {
  return {
    fileName: file.name,
    id: file.name,
    mimeType: file.type || 'image/png',
    originalFormat: 'png',
    originalSize: file.size,
    originalSourceKind: intakeKind === 'direct' ? 'direct' : 'storage',
    progress: 0,
    results: {
      png: {
        format: 'png',
        resultId: 'png',
        status: 'pending',
        variantLabel: '',
      },
    },
    status: 'pending',
  }
}

describe('queue-intake', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.stubGlobal('DataTransferItemList', MockDataTransferItemList)
  })

  it('collects all files from a dropped DataTransferItemList', async () => {
    const first = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01])],
      'first.png',
      {
        type: 'image/png',
      },
    )
    const second = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02])],
      'second.png',
      {
        type: 'image/png',
      },
    )

    let payloadsExpired = false

    const liveList = new MockDataTransferItemList([
      {
        getAsFile: () => first,
        getAsString: () => {},
        kind: 'file',
        type: first.type,
        webkitGetAsEntry: () => {
          queueMicrotask(() => {
            payloadsExpired = true
          })
          return createFileEntry(first)
        },
      } as unknown as DataTransferItem,
      {
        getAsFile: () => (payloadsExpired ? null : second),
        getAsString: () => {},
        kind: 'file',
        type: second.type,
        webkitGetAsEntry: () => (payloadsExpired ? null : createFileEntry(second)),
      } as unknown as DataTransferItem,
    ])
    liveList.prime()

    const { entries } = await collectItemsFromFiles(
      await normalizeIntakeSources(liveList as unknown as DataTransferItemList),
      { createItem },
    )
    const items = intakeEntriesToItems(entries)

    expect(items.map((item) => item.fileName)).toEqual(['first.png', 'second.png'])
  })

  it('falls back to getAsFile when no entry is available', async () => {
    const first = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      'fallback.png',
      {
        type: 'image/png',
      },
    )

    const liveList = new MockDataTransferItemList([
      {
        getAsFile: () => first,
        getAsString: () => {},
        kind: 'file',
        type: first.type,
        webkitGetAsEntry: () => null,
      } as unknown as DataTransferItem,
    ])
    liveList.prime()

    const { entries } = await collectItemsFromFiles(
      await normalizeIntakeSources(liveList as unknown as DataTransferItemList),
      { createItem },
    )
    const items = intakeEntriesToItems(entries)

    expect(items.map((item) => item.fileName)).toEqual(['fallback.png'])
  })

  it('batches getAsFileSystemHandle for multiple file items without webkit entry', async () => {
    const a = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'a.png', {
      type: 'image/png',
    })
    const b = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x48])], 'b.png', {
      type: 'image/png',
    })

    const syncCallOrder: number[] = []
    let callSeq = 0

    const mockFileHandle = (file: File): FileSystemFileHandle =>
      ({
        getFile: () => Promise.resolve(file),
        kind: 'file',
        name: file.name,
      }) as FileSystemFileHandle

    const items = [
      {
        getAsFile: () => a,
        getAsFileSystemHandle() {
          syncCallOrder.push(++callSeq)
          return Promise.resolve(mockFileHandle(a))
        },
        getAsString: () => {},
        kind: 'file',
        type: a.type,
        webkitGetAsEntry: () => null,
      },
      {
        getAsFile: () => b,
        getAsFileSystemHandle() {
          syncCallOrder.push(++callSeq)
          return Promise.resolve(mockFileHandle(b))
        },
        getAsString: () => {},
        kind: 'file',
        type: b.type,
        webkitGetAsEntry: () => null,
      },
    ] as unknown as DataTransferItem[]

    const snaps = await snapshotDataTransferItemsAsync(items)

    expect(snaps).toHaveLength(2)
    expect(snaps[0]).toEqual({ file: a, kind: 'file' })
    expect(snaps[1]).toEqual({ file: b, kind: 'file' })
    expect(syncCallOrder).toEqual([1, 2])
  })

  it('preserves drop order when mixing webkit file entry and FSA file handles', async () => {
    const webkitFile = new File([new Uint8Array([1])], 'webkit.png', {
      type: 'image/png',
    })
    const fsaFile = new File([new Uint8Array([2])], 'fsa.png', {
      type: 'image/png',
    })

    const items = [
      {
        getAsFile: () => webkitFile,
        getAsString: () => {},
        kind: 'file',
        type: webkitFile.type,
        webkitGetAsEntry: () => createFileEntry(webkitFile),
      } as unknown as DataTransferItem,
      {
        getAsFile: () => fsaFile,
        getAsFileSystemHandle() {
          return Promise.resolve({
            getFile: () => Promise.resolve(fsaFile),
            kind: 'file',
            name: fsaFile.name,
          } as FileSystemFileHandle)
        },
        getAsString: () => {},
        kind: 'file',
        type: fsaFile.type,
        webkitGetAsEntry: () => null,
      } as unknown as DataTransferItem,
    ]

    const snaps = await snapshotDataTransferItemsAsync(items)

    expect(snaps).toHaveLength(2)
    expect(snaps[0]).toEqual({
      entry: expect.objectContaining({ name: 'webkit.png' }),
      kind: 'fs-entry',
    })
    expect(snaps[1]).toEqual({ file: fsaFile, kind: 'file' })
  })
})
