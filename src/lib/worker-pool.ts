/**
 * Worker pool: manages a fixed number of workers and a task queue.
 * Single responsibility: assign tasks to idle workers and deliver messages/errors.
 */

import type { Task } from './queue-types';

export interface WorkerPoolCallbacks {
  onMessage: (workerIndex: number, data: unknown) => void;
  onError: (workerIndex: number, task: Task | null) => void;
}

/**
 * Pool of workers that process tasks. When a worker finishes (message or error),
 * the pool invokes the callback and assigns the next task if any.
 */
export class WorkerPool {
  constructor() {
    throw new Error('Legacy worker-pool is deprecated. Use workers/worker-pool-v2.ts');
  }
  addTask(): void { throw new Error('Deprecated'); }
  removeTasksForItem(): void { throw new Error('Deprecated'); }
  abortInFlightForItem(): void { throw new Error('Deprecated'); }
}
