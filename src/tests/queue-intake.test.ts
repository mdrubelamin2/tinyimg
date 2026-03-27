import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectItemsFromFiles } from '../lib/queue/queue-intake';
import type { ImageItem } from '../lib/queue-types';

function createItem(file: File): ImageItem {
  return {
    id: file.name,
    file,
    status: 'pending',
    progress: 0,
    originalSize: file.size,
    originalFormat: 'png',
    results: {
      png: { format: 'png', status: 'pending' },
    },
  };
}

function createFileEntry(file: File): FileSystemFileEntry {
  return {
    isFile: true,
    isDirectory: false,
    name: file.name,
    fullPath: `/${file.name}`,
    filesystem: {} as FileSystem,
    file: (callback: FileCallback) => {
      queueMicrotask(() => callback(file));
    },
    getParent: () => {},
  } as FileSystemFileEntry;
}

class MockDataTransferItemList {
  private readonly items: DataTransferItem[];

  constructor(items: DataTransferItem[]) {
    this.items = items;
  }

  get length() {
    return this.items.length;
  }

  [index: number]: DataTransferItem;

  item(index: number) {
    return this.items[index] ?? null;
  }

  prime() {
    for (let i = 0; i < this.items.length; i++) {
      this[i] = this.items[i]!;
    }
  }
}

describe('queue-intake', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.stubGlobal('DataTransferItemList', MockDataTransferItemList);
  });

  it('collects all files from a dropped DataTransferItemList', async () => {
    const first = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'first.png', {
      type: 'image/png',
    });
    const second = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'second.png', {
      type: 'image/png',
    });

    let payloadsExpired = false;

    const liveList = new MockDataTransferItemList([
      {
        kind: 'file',
        type: first.type,
        getAsFile: () => first,
        getAsString: () => {},
        webkitGetAsEntry: () => {
          queueMicrotask(() => {
            payloadsExpired = true;
          });
          return createFileEntry(first);
        },
      } as unknown as DataTransferItem,
      {
        kind: 'file',
        type: second.type,
        getAsFile: () => (payloadsExpired ? null : second),
        getAsString: () => {},
        webkitGetAsEntry: () => (payloadsExpired ? null : createFileEntry(second)),
      } as unknown as DataTransferItem,
    ]);
    liveList.prime();

    const items = await collectItemsFromFiles(liveList as unknown as DataTransferItemList, {
      createItem,
    });

    expect(items.map(item => item.file.name)).toEqual(['first.png', 'second.png']);
  });

  it('falls back to getAsFile when no entry is available', async () => {
    const first = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'fallback.png', {
      type: 'image/png',
    });

    const liveList = new MockDataTransferItemList([
      {
        kind: 'file',
        type: first.type,
        getAsFile: () => first,
        getAsString: () => {},
        webkitGetAsEntry: () => null,
      } as unknown as DataTransferItem,
    ]);
    liveList.prime();

    const items = await collectItemsFromFiles(liveList as unknown as DataTransferItemList, {
      createItem,
    });

    expect(items.map(item => item.file.name)).toEqual(['fallback.png']);
  });
});
