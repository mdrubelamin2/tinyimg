import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STATUS_PENDING } from '@/constants';
import type { ImageItem, WorkerResponse } from '@/lib/queue-types';
import { applyWorkerResponse, applyWorkerTaskError } from '@/lib/queue/queue-results';

function createBaseItem(): ImageItem {
  return {
    id: 'item-1',
    file: new File(['x'], 'image.png', { type: 'image/png' }),
    status: STATUS_PENDING,
    progress: 0,
    originalSize: 1,
    originalFormat: 'png',
    results: {
      webp: { format: 'webp', status: 'processing' },
    },
  };
}

describe('queue-results', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('applies worker success and marks item as success', () => {
    const queue = [createBaseItem()];
    const response: WorkerResponse = {
      id: 'item-1',
      format: 'webp',
      blob: new Blob(['abc']),
      size: 3,
      label: 'WEBP',
      status: 'success',
    };

    const next = applyWorkerResponse(queue, response);
    expect(next[0]?.status).toBe('success');
    expect(next[0]?.results['webp']?.downloadUrl).toBe('blob:test');
    expect(next[0]?.results['webp']?.size).toBe(3);
  });

  it('applies worker task error and marks item as error', () => {
    const queue = [createBaseItem()];
    const next = applyWorkerTaskError(queue, {
      id: 'item-1',
      format: 'webp',
      file: new File(['x'], 'image.png', { type: 'image/png' }),
      options: {
        format: 'webp',
        svgInternalFormat: 'webp',
        svgRasterizer: 'resvg',
        svgExportDensity: 'legacy',
        svgDisplayDpr: 2,
        qualityPercent: 100,
        resizeMaxEdge: 0,
        stripMetadata: true,
      },
    });

    expect(next[0]?.status).toBe('error');
    expect(next[0]?.results['webp']?.status).toBe('error');
  });
});

