import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** CI runners often report 2 cores → {@link computeOptimalWorkerCount} is 1; this test needs room for 2+ parallel result slots. */
vi.mock('@/capabilities/worker-count', () => ({
  computeOptimalWorkerCount: () => 8,
}))

import type { GlobalOptions } from '@/constants'
import type { ImageItem, WorkerOutboundResult } from '@/lib/queue/types'

import {
  DEFAULT_GLOBAL_OPTIONS,
  STATUS_PENDING,
  STATUS_PROCESSING,
  STATUS_SUCCESS,
} from '@/constants'
import { shouldUseLosslessRasterEncode } from '@/lib/codecs/raster/output-encode'
import { buildOutputSlots } from '@/lib/queue/output-slots'
import { registerDirectDropOriginal } from '@/storage/dropped-original-files'
import { getSessionBinaryStorage } from '@/storage/hybrid-storage'
import { persistEncodedOutput } from '@/storage/queue-binary'
import { useImageStore } from '@/store/image-store'
import { useSettingsStore } from '@/store/settings-store'

vi.mock('@/storage/queue-binary', () => {
  return {
    deleteItemPayloads: vi.fn().mockResolvedValue(undefined),
    deleteOutputPayloadKey: vi.fn().mockResolvedValue(undefined),
    outKey: vi.fn().mockReturnValue('out:mock'),
    outKeyPrefix: vi.fn().mockReturnValue('out:'),
    persistBufferedOriginalSource: vi.fn().mockResolvedValue(undefined),
    persistEncodedOutput: vi.fn().mockResolvedValue({ payloadKey: 'out:mock:key' }),
    resolveOriginalSourceFile: vi
      .fn()
      .mockImplementation(async () => new File(['mock'], 'mock.png', { type: 'image/png' })),
    srcKey: vi.fn().mockReturnValue('src:mock'),
  }
})

function createItem(id: string, name: string): ImageItem {
  const item: ImageItem = {
    fileName: name,
    id,
    mimeType: 'image/png',
    originalFormat: 'png',
    originalSize: 1,
    originalSourceKind: 'direct',
    progress: 0,
    results: {},
    status: STATUS_PENDING,
  }
  const slots = buildOutputSlots(item, DEFAULT_GLOBAL_OPTIONS)
  for (const slot of slots) {
    const lossless = shouldUseLosslessRasterEncode(
      DEFAULT_GLOBAL_OPTIONS.losslessEncoding,
      slot.resizePreset,
    )
    item.results[slot.resultId] = {
      format: slot.format,
      lossless,
      resultId: slot.resultId,
      status: STATUS_PENDING,
      variantLabel: slot.variantLabel,
    }
  }
  return item
}

function createTwoFormatItem(
  id: string,
  name: string,
  options: GlobalOptions = multiFormatOptions,
): ImageItem {
  const item: ImageItem = {
    fileName: name,
    id,
    mimeType: 'image/png',
    originalFormat: 'png',
    originalSize: 1,
    originalSourceKind: 'direct',
    progress: 0,
    results: {},
    status: STATUS_PENDING,
  }
  const slots = buildOutputSlots(item, options)
  for (const slot of slots) {
    const lossless = shouldUseLosslessRasterEncode(options.losslessEncoding, slot.resizePreset)
    item.results[slot.resultId] = {
      format: slot.format,
      lossless,
      resultId: slot.resultId,
      status: STATUS_PENDING,
      variantLabel: slot.variantLabel,
    }
  }
  return item
}

const multiFormatOptions: GlobalOptions = {
  ...DEFAULT_GLOBAL_OPTIONS,
  formats: ['webp', 'png'],
  useOriginalFormats: false,
  useOriginalSizes: true,
}

/** `buildOutputSlots` resultId for a single `png@originalSizes` + default options (e.g. `png__`) */
const DEFAULT_PNG_SLOT_ID = (() => {
  const s = buildOutputSlots(
    {
      fileName: 'x.png',
      id: 'rid',
      mimeType: 'image/png',
      originalFormat: 'png',
      originalSize: 1,
      originalSourceKind: 'direct',
      progress: 0,
      results: {},
      status: STATUS_PENDING,
    },
    DEFAULT_GLOBAL_OPTIONS,
  )
  return s[0]!.resultId
})()

describe('image-store queue progression', () => {
  beforeEach(async () => {
    useSettingsStore.getState().resetToDefaults()
    await getSessionBinaryStorage()
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
      vi.fn(() => {
        const w = new EventTarget()
        return Object.assign(w, {
          onerror: null as ((ev: ErrorEvent) => void) | null,
          onmessage: null as ((ev: MessageEvent) => void) | null,
          postMessage: vi.fn(),
          terminate: vi.fn(),
        })
      }),
    )
    // `vi.restoreAllMocks()` in afterEach clears this mock's `mockResolvedValue`.
    vi.mocked(persistEncodedOutput).mockResolvedValue({
      payloadKey: 'out:mock:key',
    })
    useImageStore.getState().clearAll()
  })

  afterEach(async () => {
    await useImageStore.getState().clearAll()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function flushAsyncWork(): Promise<void> {
    for (let i = 0; i < 40; i++) {
      await Promise.resolve()
    }
  }

  /** Two single-slot rows already in the pool (in-flight) — avoids flaking on scheduler/pool in tests. */
  function setupTwoRowsInFlightProcessing() {
    useSettingsStore.getState().setOptions({ ...DEFAULT_GLOBAL_OPTIONS })
    const first = createItem('first', 'first.png')
    const second = createItem('second', 'second.png')
    for (const row of [first, second]) {
      row.status = STATUS_PROCESSING
      for (const [rid, res] of Object.entries(row.results)) {
        if (!res) continue
        const loss = res.lossless
        row.results[rid] = {
          ...res,
          lossless: loss ?? false,
          status: STATUS_PROCESSING,
        }
      }
    }
    registerDirectDropOriginal(first.id, new File(['x'], 'first.png', { type: 'image/png' }))
    registerDirectDropOriginal(second.id, new File(['x'], 'second.png', { type: 'image/png' }))
    useImageStore.setState({
      itemOrder: [first.id, second.id],
      items: new Map([
        [first.id, first],
        [second.id, second],
      ]),
    })
    return { first, second }
  }

  it('keeps row in pendingIds when every slot is PROCESSING (no PENDING) after a full dispatch', async () => {
    useSettingsStore.getState().setOptions(multiFormatOptions)
    const row = createTwoFormatItem('a', 'a.png')
    registerDirectDropOriginal(row.id, new File(['x'], 'a.png', { type: 'image/png' }))
    useImageStore.setState({
      itemOrder: [row.id],
      items: new Map([[row.id, row]]),
    })

    for (let i = 0; i < 4; i++) {
      await useImageStore.getState()._processNextAsync(multiFormatOptions)
      await flushAsyncWork()
    }

    const it = useImageStore.getState().items.get(row.id)
    expect(it).toBeDefined()
    expect(Object.values(it!.results).some((r) => r.status === STATUS_PROCESSING)).toBe(true)
    expect(Object.values(it!.results).every((r) => r.status !== STATUS_PENDING)).toBe(true)
    expect([...useImageStore.getState().pendingIds].includes(row.id)).toBe(true)
  })

  it('starts the next pending item after the current item succeeds', async () => {
    const { first, second } = setupTwoRowsInFlightProcessing()
    const addTask = vi.spyOn(useImageStore.getState()._getPool(), 'addTask')

    const enc = new TextEncoder().encode('done')
    const b = new Uint8Array(enc.byteLength)
    b.set(enc)
    const encodedBytes = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
    const response: WorkerOutboundResult = {
      encodedBytes,
      format: 'png',
      formattedSize: (encodedBytes.byteLength / 1024).toFixed(1),
      id: first.id,
      label: 'png',
      lossless: false,
      mimeType: 'image/png',
      resultId: DEFAULT_PNG_SLOT_ID,
      savingsPercent: 0,
      size: encodedBytes.byteLength,
      type: 'RESULT',
    }

    useImageStore.getState()._applyWorkerResult(response)
    await flushAsyncWork()
    for (let i = 0; i < 120; i++) {
      await Promise.resolve()
    }

    // first finished (persisted); second row is still in-flight, no new pool tasks in this test.
    expect(useImageStore.getState().items.get(first.id)?.status).toBe(STATUS_SUCCESS)
    expect(useImageStore.getState().items.get(second.id)?.status).toBe(STATUS_PROCESSING)
    expect(addTask).toHaveBeenCalledTimes(0)
  })

  it('starts the next pending item after the current item errors', async () => {
    const { first, second } = setupTwoRowsInFlightProcessing()
    const addTask = vi.spyOn(useImageStore.getState()._getPool(), 'addTask')

    useImageStore.getState()._applyWorkerError({
      file: new File(['x'], 'first.png', { type: 'image/png' }),
      format: 'png',
      id: first.id,
      options: {
        format: 'png',
        losslessEncoding: DEFAULT_GLOBAL_OPTIONS.losslessEncoding,
        originalSize: 1,
        qualityPercent: 100,
        resizePreset: { kind: 'native' },
        resultId: DEFAULT_PNG_SLOT_ID,
        stripMetadata: DEFAULT_GLOBAL_OPTIONS.stripMetadata,
        svgDisplayDpr: 2,
        svgExportDensity: 'display' as const,
        svgInternalFormat: DEFAULT_GLOBAL_OPTIONS.svgInternalFormat,
        svgRasterizer: 'resvg' as const,
      },
      resultId: DEFAULT_PNG_SLOT_ID,
    })

    await flushAsyncWork()

    // first row errored; second is still in-flight, no new pool work in this test.
    expect(useImageStore.getState().items.get(first.id)?.status).toBe('error')
    expect(useImageStore.getState().items.get(second.id)?.status).toBe(STATUS_PROCESSING)
    expect(addTask).toHaveBeenCalledTimes(0)
  })

  it('revokes preview and result URLs when clearing finished items', () => {
    const done = createItem('done', 'done.png')
    done.status = STATUS_SUCCESS
    done.previewUrl = 'blob:preview'
    done.results[DEFAULT_PNG_SLOT_ID] = {
      downloadUrl: 'blob:result',
      format: 'png',
      label: 'PNG',
      payloadKey: 'out:done:png',
      resultId: DEFAULT_PNG_SLOT_ID,
      size: 2,
      status: STATUS_SUCCESS,
    }

    const keep = createItem('keep', 'keep.png')
    keep.status = STATUS_PROCESSING

    useImageStore.setState({
      itemOrder: [done.id, keep.id],
      items: new Map([
        [done.id, done],
        [keep.id, keep],
      ]),
    })

    useImageStore.getState().clearFinished()

    const revoke = vi.mocked(URL.revokeObjectURL)
    expect(revoke).toHaveBeenCalledWith('blob:preview')
    expect(revoke).toHaveBeenCalledWith('blob:result')
    expect(useImageStore.getState().itemOrder).toEqual([keep.id])
  })
})
