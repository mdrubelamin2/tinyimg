import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectItemsFromFiles,
  intakeEntriesToItems,
  normalizeIntakeSources,
  snapshotDataTransferItemsAsync,
  type IntakeOriginalKind,
} from '@/lib/queue/queue-intake';
import type { ImageItem } from '@/lib/queue/types';

function createItem(file: File, intakeKind: IntakeOriginalKind): ImageItem {
  return {
    id: file.name,
    fileName: file.name,
    mimeType: file.type || 'image/png',
    originalSourceKind: intakeKind === 'direct' ? 'direct' : 'storage',
    status: 'pending',
    progress: 0,
    originalSize: file.size,
    originalFormat: 'png',
    results: {
      png: { resultId: 'png', format: 'png', variantLabel: '', status: 'pending' },
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
    const first = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01])], 'first.png', {
      type: 'image/png',
    });
    const second = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02])], 'second.png', {
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

    const { entries } = await collectItemsFromFiles(
      await normalizeIntakeSources(liveList as unknown as DataTransferItemList),
      { createItem }
    );
    const items = intakeEntriesToItems(entries);

    expect(items.map(item => item.fileName)).toEqual(['first.png', 'second.png']);
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

    const { entries } = await collectItemsFromFiles(
      await normalizeIntakeSources(liveList as unknown as DataTransferItemList),
      { createItem }
    );
    const items = intakeEntriesToItems(entries);

    expect(items.map(item => item.fileName)).toEqual(['fallback.png']);
  });

  it('batches getAsFileSystemHandle for multiple file items without webkit entry', async () => {
    const a = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'a.png', { type: 'image/png' });
    const b = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x48])], 'b.png', { type: 'image/png' });

    const syncCallOrder: number[] = [];
    let callSeq = 0;

    const mockFileHandle = (file: File): FileSystemFileHandle =>
      ({
        kind: 'file',
        name: file.name,
        getFile: () => Promise.resolve(file),
      }) as FileSystemFileHandle;

    const items = [
      {
        kind: 'file',
        type: a.type,
        getAsString: () => {},
        getAsFile: () => a,
        webkitGetAsEntry: () => null,
        getAsFileSystemHandle() {
          syncCallOrder.push(++callSeq);
          return Promise.resolve(mockFileHandle(a));
        },
      },
      {
        kind: 'file',
        type: b.type,
        getAsString: () => {},
        getAsFile: () => b,
        webkitGetAsEntry: () => null,
        getAsFileSystemHandle() {
          syncCallOrder.push(++callSeq);
          return Promise.resolve(mockFileHandle(b));
        },
      },
    ] as unknown as DataTransferItem[];

    const snaps = await snapshotDataTransferItemsAsync(items);

    expect(snaps).toHaveLength(2);
    expect(snaps[0]).toEqual({ kind: 'file', file: a });
    expect(snaps[1]).toEqual({ kind: 'file', file: b });
    expect(syncCallOrder).toEqual([1, 2]);
  });

  it('preserves drop order when mixing webkit file entry and FSA file handles', async () => {
    const webkitFile = new File([new Uint8Array([1])], 'webkit.png', { type: 'image/png' });
    const fsaFile = new File([new Uint8Array([2])], 'fsa.png', { type: 'image/png' });

    const items = [
      {
        kind: 'file',
        type: webkitFile.type,
        getAsString: () => {},
        getAsFile: () => webkitFile,
        webkitGetAsEntry: () => createFileEntry(webkitFile),
      } as unknown as DataTransferItem,
      {
        kind: 'file',
        type: fsaFile.type,
        getAsString: () => {},
        getAsFile: () => fsaFile,
        webkitGetAsEntry: () => null,
        getAsFileSystemHandle() {
          return Promise.resolve({
            kind: 'file',
            name: fsaFile.name,
            getFile: () => Promise.resolve(fsaFile),
          } as FileSystemFileHandle);
        },
      } as unknown as DataTransferItem,
    ];

    const snaps = await snapshotDataTransferItemsAsync(items);

    expect(snaps).toHaveLength(2);
    expect(snaps[0]).toEqual({ kind: 'fs-entry', entry: expect.objectContaining({ name: 'webkit.png' }) });
    expect(snaps[1]).toEqual({ kind: 'file', file: fsaFile });
  });
});
