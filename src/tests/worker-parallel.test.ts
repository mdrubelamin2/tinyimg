import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerPool, type WorkerPoolCallbacks } from '../workers/worker-pool-v2';

// Mock Worker
class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

vi.stubGlobal('Worker', MockWorker);

describe('WorkerPool Parallel Dispatch', () => {
  let callbacks: WorkerPoolCallbacks;
  let pool: WorkerPool;

  beforeEach(() => {
    callbacks = {
      onMessage: vi.fn(),
      onError: vi.fn(),
      onActiveCountChange: vi.fn(),
    };
    pool = new WorkerPool(4, callbacks);
  });

  it('should dispatch tasks in parallel (bypassing stagger in test)', async () => {
    // Manually populate allWorkers to bypass the staggering logic for the test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pool as any).allWorkers.add({ worker: new MockWorker() });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pool as any).allWorkers.add({ worker: new MockWorker() });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pool as any).idleWorkers.push(...(pool as any).allWorkers);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task1 = { id: 'item1', resultId: 'res1', format: 'webp', file: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) } as unknown as File, options: {} as any };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const task2 = { id: 'item2', resultId: 'res2', format: 'webp', file: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) } as unknown as File, options: {} as any };

    pool.addTask(task1);
    pool.addTask(task2);

    // Wait for internal microtasks
    await new Promise(r => setTimeout(r, 0));

    // Check that we have 2 active tasks simultaneously
    expect(pool.activeCount).toBe(2);
  });
});
