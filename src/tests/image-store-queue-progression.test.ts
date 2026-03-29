import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GLOBAL_OPTIONS, STATUS_PENDING, STATUS_PROCESSING, STATUS_SUCCESS } from '@/constants';
import type { ImageItem, WorkerOutboundResult } from '@/lib/queue/types';
import { useImageStore } from '@/store/image-store';

function createItem(id: string, name: string): ImageItem {
  return {
    id,
    file: new File(['x'], name, { type: 'image/png' }),
    status: STATUS_PENDING,
    progress: 0,
    originalSize: 1,
    originalFormat: 'png',
    results: {
      png: { format: 'png', status: STATUS_PENDING },
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
      vi.fn(() => ({
        onmessage: null,
        onerror: null,
        postMessage: vi.fn(),
        terminate: vi.fn(),
      }))
    );
    useImageStore.getState().clearAll();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useImageStore.getState().clearAll();
  });

  function seedTwoPendingItems() {
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

    const pool = useImageStore.getState()._getPool();
    const addTask = vi.spyOn(pool, 'addTask').mockImplementation(() => {});

    useImageStore.getState()._processNext(DEFAULT_GLOBAL_OPTIONS);

    expect(useImageStore.getState().items.get(first.id)?.status).toBe(STATUS_PROCESSING);
    expect(useImageStore.getState().items.get(second.id)?.status).toBe(STATUS_PENDING);
    expect(addTask).toHaveBeenCalledTimes(1);
    expect(addTask).toHaveBeenLastCalledWith(expect.objectContaining({ id: first.id, format: 'png' }));

    return { addTask, first, second };
  }

  it('starts the next pending item after the current item succeeds', () => {
    const { addTask, first, second } = seedTwoPendingItems();

    const response: WorkerOutboundResult = {
      type: 'RESULT',
      id: first.id,
      format: 'png',
      blob: new Blob(['done']),
      size: 4,
      label: 'png',
      formattedSize: '4.0',
      savingsPercent: 0,
    };

    useImageStore.getState()._applyWorkerResult(response);

    expect(useImageStore.getState().items.get(first.id)?.status).toBe(STATUS_SUCCESS);
    expect(useImageStore.getState().items.get(second.id)?.status).toBe(STATUS_PROCESSING);
    expect(addTask).toHaveBeenCalledTimes(2);
    expect(addTask).toHaveBeenLastCalledWith(expect.objectContaining({ id: second.id, format: 'png' }));
  });

  it('starts the next pending item after the current item errors', () => {
    const { addTask, first, second } = seedTwoPendingItems();

    useImageStore.getState()._applyWorkerError({
      id: first.id,
      format: 'png',
      file: first.file,
      options: {
        format: 'png',
        svgInternalFormat: DEFAULT_GLOBAL_OPTIONS.svgInternalFormat,
        svgRasterizer: 'resvg' as const,
        svgExportDensity: 'display' as const,
        svgDisplayDpr: 2,
        qualityPercent: 100,
        resizeMaxEdge: 0,
        stripMetadata: DEFAULT_GLOBAL_OPTIONS.stripMetadata,
      },
    });

    expect(useImageStore.getState().items.get(first.id)?.status).toBe('error');
    expect(useImageStore.getState().items.get(second.id)?.status).toBe(STATUS_PROCESSING);
    expect(addTask).toHaveBeenCalledTimes(2);
    expect(addTask).toHaveBeenLastCalledWith(expect.objectContaining({ id: second.id, format: 'png' }));
  });

  it('revokes preview and result URLs when clearing finished items', () => {
    const done = createItem('done', 'done.png');
    done.status = STATUS_SUCCESS;
    done.previewUrl = 'blob:preview';
    done.results['png'] = {
      format: 'png',
      status: STATUS_SUCCESS,
      blob: new Blob(['ok']),
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
