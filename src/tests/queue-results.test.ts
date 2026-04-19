import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERR_WORKER, STATUS_PENDING, STATUS_PROCESSING, STATUS_SUCCESS, STATUS_ERROR } from '@/constants';
import type { ImageItem, WorkerOutboundResult } from '@/lib/queue/types';
import * as queueBinary from '@/storage/queue-binary';
import { getSessionBinaryStorage } from '@/storage/hybrid-storage';
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

function resultPayload(
  id: string,
  resultId: string,
  format: string,
  bytes: Uint8Array
): WorkerOutboundResult {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buf = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as ArrayBuffer;
  return {
    type: 'RESULT',
    id,
    resultId,
    format,
    encodedBytes: buf,
    mimeType: `image/${format === 'jpeg' ? 'jpeg' : format}`,
    size: buf.byteLength,
    label: format.toUpperCase(),
    formattedSize: (buf.byteLength / 1024).toFixed(1),
    savingsPercent: 0,
  };
}

describe('queue worker results via image-store', () => {
  beforeEach(async () => {
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
    await getSessionBinaryStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useImageStore.getState().clearAll();
  });

  async function flushAsyncWork(): Promise<void> {
    for (let i = 0; i < 120; i++) {
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

    const response = resultPayload('item-1', 'webp', 'webp', new Uint8Array([97, 98, 99]));

    useImageStore.getState()._applyWorkerResult(response);
    await flushAsyncWork();

    const updated = useImageStore.getState().items.get('item-1');
    expect(updated?.status).toBe(STATUS_SUCCESS);
    expect(updated?.results['webp']?.payloadKey).toBe('out:item-1:webp');
    expect(updated?.results['webp']?.downloadUrl).toBeUndefined();
    expect(updated?.results['webp']?.size).toBe(3);
  });

  it('serializes persistEncodedOutput when two RESULTs flush in one RAF batch', async () => {
    const rafQ: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQ.push(cb);
      return rafQ.length;
    });

    const item: ImageItem = {
      ...createBaseItem(),
      results: {
        webp: {
          resultId: 'webp',
          format: 'webp',
          variantLabel: '',
          status: STATUS_PROCESSING,
        },
        png: {
          resultId: 'png',
          format: 'png',
          variantLabel: '',
          status: STATUS_PROCESSING,
        },
      },
    };
    useImageStore.setState({
      items: new Map([[item.id, item]]),
      itemOrder: [item.id],
      pendingIds: new Set([item.id]),
    });

    let inflight = 0;
    let maxInflight = 0;
    const persistSpy = vi.spyOn(queueBinary, 'persistEncodedOutput').mockImplementation(async (id, resultId) => {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 12));
      inflight--;
      return { payloadKey: `out:${id}:${resultId}` };
    });

    useImageStore.getState()._applyWorkerResult(resultPayload('item-1', 'webp', 'webp', new Uint8Array([1])));
    useImageStore.getState()._applyWorkerResult(resultPayload('item-1', 'png', 'png', new Uint8Array([2])));
    expect(rafQ.length).toBe(1);
    rafQ.shift()!(0);
    await flushAsyncWork();
    await vi.waitUntil(() => persistSpy.mock.calls.length >= 2, { timeout: 3000, interval: 5 });

    expect(maxInflight).toBe(1);
    expect(persistSpy).toHaveBeenCalledTimes(2);
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
