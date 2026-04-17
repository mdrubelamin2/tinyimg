import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERR_WORKER, STATUS_PENDING, STATUS_PROCESSING, STATUS_SUCCESS, STATUS_ERROR } from '@/constants';
import type { ImageItem, WorkerOutboundResult } from '@/lib/queue/types';
import { useImageStore } from '@/store/image-store';

function createBaseItem(): ImageItem {
  return {
    id: 'item-1',
    fileName: 'image.png',
    mimeType: 'image/png',
    originalSourceKind: 'direct',
    status: STATUS_PENDING,
    progress: 0,
    originalSize: 1,
    originalFormat: 'png',
    results: {
      webp: {
        resultId: 'webp',
        format: 'webp',
        variantLabel: '',
        status: STATUS_PROCESSING,
      },
    },
  };
}

describe('queue worker results via image-store', () => {
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

  async function flushAsyncWork(): Promise<void> {
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
    }
  }

  it('applies worker RESULT and marks item success with persisted output', async () => {
    const item = createBaseItem();
    useImageStore.setState({
      items: new Map([[item.id, item]]),
      itemOrder: [item.id],
      pendingIds: new Set([item.id]),
    });

    const response: WorkerOutboundResult = {
      type: 'RESULT',
      id: 'item-1',
      resultId: 'webp',
      format: 'webp',
      blob: new Blob(['abc']),
      size: 3,
      label: 'WEBP',
      formattedSize: '3.0',
      savingsPercent: 0,
    };

    useImageStore.getState()._applyWorkerResult(response);
    await flushAsyncWork();

    const updated = useImageStore.getState().items.get('item-1');
    expect(updated?.status).toBe(STATUS_SUCCESS);
    expect(updated?.results['webp']?.downloadUrl).toBe('blob:test');
    expect(updated?.results['webp']?.payloadKey).toBe('out:item-1:webp');
    expect(updated?.results['webp']?.size).toBe(3);
  });

  it('applies worker pool error and marks item and format as error', async () => {
    const item = createBaseItem();
    useImageStore.setState({
      items: new Map([[item.id, item]]),
      itemOrder: [item.id],
      pendingIds: new Set([item.id]),
    });

    useImageStore.getState()._applyWorkerError({
      id: 'item-1',
      resultId: 'webp',
      format: 'webp',
      file: new File(['x'], 'image.png', { type: 'image/png' }),
      options: {
        resultId: 'webp',
        format: 'webp',
        svgInternalFormat: 'webp',
        svgRasterizer: 'resvg',
        svgExportDensity: 'legacy',
        svgDisplayDpr: 2,
        qualityPercent: 100,
        resizePreset: { kind: 'native' },
        stripMetadata: true,
      },
    });
    useImageStore.getState()._batchApplyResults();

    const updated = useImageStore.getState().items.get('item-1');
    expect(updated?.status).toBe(STATUS_ERROR);
    expect(updated?.results['webp']?.status).toBe(STATUS_ERROR);
    expect(updated?.results['webp']?.error).toBe(ERR_WORKER);
  });
});
