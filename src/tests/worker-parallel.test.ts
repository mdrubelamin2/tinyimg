import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TaskOptions } from '../lib/queue/types'

import { WorkerPool, type WorkerPoolCallbacks } from '../workers/worker-pool-v2'

// Mock Worker
class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
}

vi.stubGlobal('Worker', MockWorker)

const MOCK_OPTIONS: TaskOptions = {
  format: 'webp',
  losslessEncoding: 'none',
  originalSize: 10,
  qualityPercent: 80,
  resizePreset: { kind: 'native' },
  resultId: 'res1',
  stripMetadata: true,
  svgDisplayDpr: 1,
  svgExportDensity: 'display',
  svgInternalFormat: 'webp',
  svgRasterizer: 'auto',
}

describe('WorkerPool Parallel Dispatch', () => {
  let callbacks: WorkerPoolCallbacks
  let pool: WorkerPool

  beforeEach(() => {
    callbacks = {
      onActiveCountChange: vi.fn(),
      onError: vi.fn(),
      onMessage: vi.fn(),
    }
    pool = new WorkerPool(4, callbacks)
  })

  it('should dispatch tasks in parallel (bypassing stagger in test)', async () => {
    // Manually populate allWorkers to bypass the staggering logic for the test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pool as any).allWorkers.add({ worker: new MockWorker() })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pool as any).allWorkers.add({ worker: new MockWorker() })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pool as any).idleWorkers.push(...(pool as any).allWorkers)

    const task1 = {
      file: new File([], 'item1.webp'),
      format: 'webp',
      id: 'item1',
      options: { ...MOCK_OPTIONS, resultId: 'res1' },
      resultId: 'res1',
    }

    const task2 = {
      file: new File([], 'item2.webp'),
      format: 'webp',
      id: 'item2',
      options: { ...MOCK_OPTIONS, resultId: 'res2' },
      resultId: 'res2',
    }

    pool.addTask(task1)
    pool.addTask(task2)

    // Wait for internal microtasks
    await new Promise((r) => setTimeout(r, 0))

    // Check that we have 2 active tasks simultaneously
    expect(pool.activeCount).toBe(2)
  })
})
