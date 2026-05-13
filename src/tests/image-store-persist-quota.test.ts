import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageItem, WorkerOutboundResult } from '@/lib/queue/types'

import {
  RESULT_PERSIST_BATCH_MAX_BYTES,
  RESULT_PERSIST_BATCH_MAX_ITEMS,
  STATUS_ERROR,
  STATUS_PROCESSING,
  STATUS_SUCCESS,
} from '@/constants'
import { chunkResultResponsesForPersist } from '@/services/storage-sync'
import { registerDirectDropOriginal } from '@/storage/dropped-original-files'
import { useImageStore } from '@/store/image-store'

vi.mock('@/storage/queue-binary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/storage/queue-binary')>()
  return {
    ...actual,
    persistEncodedOutput: vi.fn(),
  }
})

import { persistEncodedOutput } from '@/storage/queue-binary'

function ab(data: string): ArrayBuffer {
  const enc = new TextEncoder().encode(data)
  return enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength)
}

function createProcessingTwoSlotItem(id: string): ImageItem {
  return {
    fileName: 'x.png',
    id,
    mimeType: 'image/png',
    originalFormat: 'png',
    originalSize: 100,
    originalSourceKind: 'direct',
    progress: 50,
    results: {
      png: { format: 'png', resultId: 'png', status: STATUS_PROCESSING },
      webp: { format: 'webp', resultId: 'webp', status: STATUS_PROCESSING },
    },
    status: STATUS_PROCESSING,
  }
}

describe('chunkResultResponsesForPersist', () => {
  it('splits when item count exceeds max', () => {
    const mk = (i: number): WorkerOutboundResult => ({
      encodedBytes: ab('x'),
      format: 'png',
      formattedSize: '1',
      id: 'a',
      label: 'x',
      lossless: false,
      mimeType: 'image/png',
      resultId: `r${i}`,
      savingsPercent: 0,
      size: 1,
      type: 'RESULT',
    })
    const rows = Array.from({ length: RESULT_PERSIST_BATCH_MAX_ITEMS + 2 }, (_, i) => mk(i))
    const chunks = chunkResultResponsesForPersist(rows)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[0]!.length).toBe(RESULT_PERSIST_BATCH_MAX_ITEMS)
    expect(chunks.reduce((n, c) => n + c.length, 0)).toBe(rows.length)
  })

  it('splits when byte budget would be exceeded', () => {
    const half = Math.floor(RESULT_PERSIST_BATCH_MAX_BYTES / 2) + 1
    const buf = new ArrayBuffer(half)
    const a: WorkerOutboundResult = {
      encodedBytes: buf,
      format: 'png',
      formattedSize: '1',
      id: 'a',
      label: 'a',
      lossless: false,
      mimeType: 'image/png',
      resultId: 'a1',
      savingsPercent: 0,
      size: half,
      type: 'RESULT',
    }
    const b: WorkerOutboundResult = { ...a, resultId: 'a2' }
    const chunks = chunkResultResponsesForPersist([a, b])
    expect(chunks.length).toBe(2)
    expect(chunks[0]!.length).toBe(1)
    expect(chunks[1]!.length).toBe(1)
  })
})

describe('schedulePersistWorkerResults quota handling', () => {
  beforeEach(() => {
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
    vi.stubGlobal('startTransition', (cb: () => void) => {
      cb()
    })
    vi.mocked(persistEncodedOutput).mockReset()
    vi.mocked(persistEncodedOutput).mockResolvedValue({
      payloadKey: 'out:test:key',
    })
    useImageStore.getState().clearAll()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    useImageStore.getState().clearAll()
  })

  async function flushAsyncWork(): Promise<void> {
    for (let i = 0; i < 40; i++) {
      await Promise.resolve()
    }
  }

  function resultPayload(id: string, resultId: string, data: string): WorkerOutboundResult {
    const enc = new TextEncoder().encode(data)
    return {
      encodedBytes: enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength),
      format: resultId,
      formattedSize: String(data.length),
      id,
      label: resultId,
      lossless: false,
      mimeType: 'image/png',
      resultId,
      savingsPercent: 0,
      size: data.length,
      type: 'RESULT',
    }
  }

  it('does not drop remaining items in the same batch when first persist throws QuotaExceededError', async () => {
    const id = 'dual'
    const item = createProcessingTwoSlotItem(id)

    useImageStore.setState({
      itemOrder: [id],
      items: new Map([[id, item]]),
    })
    registerDirectDropOriginal(id, new File(['x'], 'x.png', { type: 'image/png' }))

    const quotaErr = new DOMException('quota', 'QuotaExceededError')
    vi.mocked(persistEncodedOutput)
      .mockRejectedValueOnce(quotaErr)
      .mockResolvedValueOnce({ payloadKey: 'out:ok' })

    useImageStore.getState()._applyWorkerResult(resultPayload(id, 'png', 'first'))
    useImageStore.getState()._applyWorkerResult(resultPayload(id, 'webp', 'second'))
    await flushAsyncWork()

    expect(persistEncodedOutput).toHaveBeenCalledTimes(2)

    const updated = useImageStore.getState().items.get(id)!
    expect(updated.results['png']?.status).toBe(STATUS_ERROR)
    expect(updated.results['webp']?.status).toBe(STATUS_SUCCESS)
    expect(updated.status).toBe(STATUS_ERROR)
  })

  it('still persists after a prior batch failed on quota', async () => {
    const id1 = 'one'
    const id2 = 'two'
    const item1 = createProcessingTwoSlotItem(id1)
    item1.results = {
      png: { format: 'png', resultId: 'png', status: STATUS_PROCESSING },
    }
    const item2 = {
      ...createProcessingTwoSlotItem(id2),
      results: {
        png: { format: 'png', resultId: 'png', status: STATUS_PROCESSING },
      },
    }

    useImageStore.setState({
      itemOrder: [id1, id2],
      items: new Map([
        [id1, item1],
        [id2, item2],
      ]),
    })
    registerDirectDropOriginal(id1, new File(['a'], 'a.png', { type: 'image/png' }))
    registerDirectDropOriginal(id2, new File(['b'], 'b.png', { type: 'image/png' }))

    const quotaErr = new DOMException('quota', 'QuotaExceededError')
    vi.mocked(persistEncodedOutput)
      .mockRejectedValueOnce(quotaErr)
      .mockResolvedValue({ payloadKey: 'out:ok' })

    useImageStore.getState()._applyWorkerResult(resultPayload(id1, 'png', 'fail-batch'))
    await flushAsyncWork()

    useImageStore.getState()._applyWorkerResult(resultPayload(id2, 'png', 'ok-batch'))
    await flushAsyncWork()

    expect(persistEncodedOutput).toHaveBeenCalledTimes(2)
    expect(useImageStore.getState().items.get(id1)?.results['png']?.status).toBe(STATUS_ERROR)
    expect(useImageStore.getState().items.get(id2)?.results['png']?.status).toBe(STATUS_SUCCESS)
  })
})
