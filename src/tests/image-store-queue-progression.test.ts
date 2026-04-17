import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GLOBAL_OPTIONS, STATUS_PENDING, STATUS_PROCESSING, STATUS_SUCCESS } from '@/constants';
import type { ImageItem, WorkerOutboundResult } from '@/lib/queue/types';
import { registerDirectDropOriginal } from '@/storage/dropped-original-files';
import { useImageStore } from '@/store/image-store';

function createItem(id: string, name: string): ImageItem {
  return {
    id,
    fileName: name,
    mimeType: 'image/png',
    originalSourceKind: 'direct',
    status: STATUS_PENDING,
    progress: 0,
    originalSize: 1,
    originalFormat: 'png',
    results: {
      png: {
        resultId: 'png',
        format: 'png',
        variantLabel: '',
        status: STATUS_PENDING,
      },
    },
  };
}

describe('image-store queue progression', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal(
      'Worker',
      vi.fn(() => {
        const w = new EventTarget();
        return Object.assign(w, {
          onmessage: null as null | ((ev: MessageEvent) => void),
          onerror: null as null | ((ev: ErrorEvent) => void),
          postMessage: vi.fn(),
          terminate: vi.fn(),
        });
      })
    );
    useImageStore.getState().clearAll();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useImageStore.getState().clearAll();
  });

  async function flushAsyncWork(): Promise<void> {
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
    }
  }

  async function seedTwoPendingItems() {
    const first = createItem('first', 'first.png');
    const second = createItem('second', 'second.png');

    useImageStore.setState({
      items: new Map([
        [first.id, first],
        [second.id, second],
      ]),
      itemOrder: [first.id, second.id],
      pendingIds: new Set([first.id, second.id]),
    });

    registerDirectDropOriginal(first.id, new File(['x'], 'first.png', { type: 'image/png' }));
    registerDirectDropOriginal(second.id, new File(['x'], 'second.png', { type: 'image/png' }));

    const pool = useImageStore.getState()._getPool();
    const addTask = vi.spyOn(pool, 'addTask').mockImplementation(() => {});

    void useImageStore.getState()._processNextAsync(DEFAULT_GLOBAL_OPTIONS, { getState: useImageStore.getState });
    await flushAsyncWork();

    expect(useImageStore.getState().items.get(first.id)?.status).toBe(STATUS_PROCESSING);
    expect(useImageStore.getState().items.get(second.id)?.status).toBe(STATUS_PENDING);
    expect(addTask).toHaveBeenCalledTimes(1);
    expect(addTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: first.id, resultId: 'png', format: 'png' })
    );

    return { addTask, first, second };
  }

  it('starts the next pending item after the current item succeeds', async () => {
    const { addTask, first, second } = await seedTwoPendingItems();

    const response: WorkerOutboundResult = {
      type: 'RESULT',
      id: first.id,
      resultId: 'png',
      format: 'png',
      blob: new Blob(['done']),
      size: 4,
      label: 'png',
      formattedSize: '4.0',
      savingsPercent: 0,
    };

    useImageStore.getState()._applyWorkerResult(response);
    await flushAsyncWork();
    await vi.waitUntil(
      () => useImageStore.getState().items.get(second.id)?.status === STATUS_PROCESSING,
      { timeout: 2000, interval: 1 }
    );

    expect(useImageStore.getState().items.get(first.id)?.status).toBe(STATUS_SUCCESS);
    expect(useImageStore.getState().items.get(second.id)?.status).toBe(STATUS_PROCESSING);
    expect(addTask).toHaveBeenCalledTimes(2);
    expect(addTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: second.id, resultId: 'png', format: 'png' })
    );
  });

  it('starts the next pending item after the current item errors', async () => {
    const { addTask, first, second } = await seedTwoPendingItems();

    useImageStore.getState()._applyWorkerError({
      id: first.id,
      resultId: 'png',
      format: 'png',
      file: new File(['x'], 'first.png', { type: 'image/png' }),
      options: {
        resultId: 'png',
        format: 'png',
        svgInternalFormat: DEFAULT_GLOBAL_OPTIONS.svgInternalFormat,
        svgRasterizer: 'resvg' as const,
        svgExportDensity: 'display' as const,
        svgDisplayDpr: 2,
        qualityPercent: 100,
        resizePreset: { kind: 'native' },
        stripMetadata: DEFAULT_GLOBAL_OPTIONS.stripMetadata,
      },
    });

    await flushAsyncWork();

    expect(useImageStore.getState().items.get(first.id)?.status).toBe('error');
    expect(useImageStore.getState().items.get(second.id)?.status).toBe(STATUS_PROCESSING);
    expect(addTask).toHaveBeenCalledTimes(2);
    expect(addTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: second.id, resultId: 'png', format: 'png' })
    );
  });

  it('revokes preview and result URLs when clearing finished items', () => {
    const done = createItem('done', 'done.png');
    done.status = STATUS_SUCCESS;
    done.previewUrl = 'blob:preview';
    done.results['png'] = {
      resultId: 'png',
      format: 'png',
      status: STATUS_SUCCESS,
      payloadKey: 'out:done:png',
      size: 2,
      downloadUrl: 'blob:result',
      label: 'PNG',
    };

    const keep = createItem('keep', 'keep.png');
    keep.status = STATUS_PROCESSING;

    useImageStore.setState({
      items: new Map([
        [done.id, done],
        [keep.id, keep],
      ]),
      itemOrder: [done.id, keep.id],
    });

    useImageStore.getState().clearFinished();

    const revoke = vi.mocked(URL.revokeObjectURL);
    expect(revoke).toHaveBeenCalledWith('blob:preview');
    expect(revoke).toHaveBeenCalledWith('blob:result');
    expect(useImageStore.getState().itemOrder).toEqual([keep.id]);
  });
});
