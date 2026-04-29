import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageItem, WorkerOutboundResult } from '@/lib/queue/types'

import {
  ERR_WORKER,
  STATUS_ERROR,
  STATUS_PENDING,
  STATUS_PROCESSING,
  STATUS_SUCCESS,
} from '@/constants'
import { getSessionBinaryStorage } from '@/storage/hybrid-storage'
import * as queueBinary from '@/storage/queue-binary'
import { useImageStore } from '@/store/image-store'

function createBaseItem(): ImageItem {
  return {
    fileName: 'image.png',
    id: 'item-1',
    mimeType: 'image/png',
    originalFormat: 'png',
    originalSize: 1,
    originalSourceKind: 'direct',
    progress: 0,
    results: {
      webp: {
        format: 'webp',
        resultId: 'webp',
        status: STATUS_PROCESSING,
        variantLabel: '',
      },
    },
    status: STATUS_PENDING,
  }
}

function resultPayload(
  id: string,
  resultId: string,
  format: string,
  bytes: Uint8Array,
): WorkerOutboundResult {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const buf = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as ArrayBuffer
  return {
    encodedBytes: buf,
    format,
    formattedSize: (buf.byteLength / 1024).toFixed(1),
    id,
    label: format.toUpperCase(),
    lossless: false,
    mimeType: `image/${format === 'jpeg' ? 'jpeg' : format}`,
    resultId,
    savingsPercent: 0,
    size: buf.byteLength,
    type: 'RESULT',
  }
}

describe('queue worker results via image-store', () => {
  beforeEach(async () => {
    vi.stubGlobal('window', {
      innerWidth: 1920,
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    vi.stubGlobal(
      'Worker',
      vi.fn(() => ({
        onerror: null,
        onmessage: null,
        postMessage: vi.fn(),
        terminate: vi.fn(),
      })),
    )
    useImageStore.getState().clearAll()
    await getSessionBinaryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    useImageStore.getState().clearAll()
  })

  async function flushAsyncWork(): Promise<void> {
    for (let i = 0; i < 120; i++) {
      await Promise.resolve()
    }
  }

  it('applies worker RESULT and marks item success with persisted output', async () => {
    const item = createBaseItem()
    useImageStore.setState({
      itemOrder: [item.id],
      items: new Map([[item.id, item]]),
    })

    const response = resultPayload('item-1', 'webp', 'webp', new Uint8Array([97, 98, 99]))

    useImageStore.getState()._applyWorkerResult(response)
    await flushAsyncWork()

    const updated = useImageStore.getState().items.get('item-1')
    expect(updated?.status).toBe(STATUS_SUCCESS)
    expect(updated?.results['webp']?.payloadKey).toBe('out:item-1:webp')
    expect(updated?.results['webp']?.downloadUrl).toBeUndefined()
    expect(updated?.results['webp']?.size).toBe(3)
  })

  it('serializes persistEncodedOutput when two RESULTs flush in one RAF batch', async () => {
    const rafQ: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQ.push(cb)
      return rafQ.length
    })

    const item: ImageItem = {
      ...createBaseItem(),
      results: {
        png: {
          format: 'png',
          resultId: 'png',
          status: STATUS_PROCESSING,
          variantLabel: '',
        },
        webp: {
          format: 'webp',
          resultId: 'webp',
          status: STATUS_PROCESSING,
          variantLabel: '',
        },
      },
    }
    useImageStore.setState({
      itemOrder: [item.id],
      items: new Map([[item.id, item]]),
    })

    let inflight = 0
    let maxInflight = 0
    const persistSpy = vi
      .spyOn(queueBinary, 'persistEncodedOutput')
      .mockImplementation(async (id, resultId) => {
        inflight++
        maxInflight = Math.max(maxInflight, inflight)
        await new Promise((r) => setTimeout(r, 12))
        inflight--
        return { payloadKey: `out:${id}:${resultId}` }
      })

    useImageStore
      .getState()
      ._applyWorkerResult(resultPayload('item-1', 'webp', 'webp', new Uint8Array([1])))
    useImageStore
      .getState()
      ._applyWorkerResult(resultPayload('item-1', 'png', 'png', new Uint8Array([2])))
    await flushAsyncWork()
    await vi.waitUntil(() => persistSpy.mock.calls.length >= 2, {
      interval: 5,
      timeout: 3000,
    })

    expect(maxInflight).toBe(1)
    expect(persistSpy).toHaveBeenCalledTimes(2)
  })

  it('applies worker pool error and marks item and format as error', async () => {
    const item = createBaseItem()
    useImageStore.setState({
      itemOrder: [item.id],
      items: new Map([[item.id, item]]),
    })

    useImageStore.getState()._applyWorkerError({
      file: new File(['x'], 'image.png', { type: 'image/png' }),
      format: 'webp',
      id: 'item-1',
      options: {
        format: 'webp',
        losslessEncoding: 'none',
        originalSize: 1,
        qualityPercent: 100,
        resizePreset: { kind: 'native' },
        resultId: 'webp',
        stripMetadata: true,
        svgDisplayDpr: 2,
        svgExportDensity: 'legacy',
        svgInternalFormat: 'webp',
        svgRasterizer: 'resvg',
      },
      resultId: 'webp',
    })
    useImageStore.getState()._batchApplyResults()

    const updated = useImageStore.getState().items.get('item-1')
    expect(updated?.status).toBe(STATUS_ERROR)
    expect(updated?.results['webp']?.status).toBe(STATUS_ERROR)
    expect(updated?.results['webp']?.error).toBe(ERR_WORKER)
  })
})
