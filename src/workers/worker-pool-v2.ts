/**
 * Optimizer concurrency via multithreading.js: managed worker pool + move() for
 * structured clone of task payloads. Preserves cancel + pending-queue semantics
 * of the previous hand-rolled WorkerPool.
 */

import { spawn, move, initRuntime, shutdown, type JoinHandle } from 'multithreading';
import type { Task, WorkerOutbound } from '@/lib/queue/types.ts';
import { computeOptimalWorkerCount } from '@/capabilities/worker-count.ts';

export interface WorkerPoolCallbacks {
  onMessage: (workerIndex: number, data: WorkerOutbound) => void;
  onError: (workerIndex: number, task: Task | null) => void;
  onCancelled?: (taskId: string) => void;
}

export function computeConcurrency(): number {
  return computeOptimalWorkerCount();
}

type TaskKey = string;

function taskKey(task: Task): TaskKey {
  return `${task.id}:${task.format}`;
}

/** Reset in `destroy()` so a later pool can call `initRuntime` again after `shutdown()`. */
let optimizerRuntimeInited = false;

/**
 * Pool: bounded concurrent `spawn()` calls into multithreading's global pool,
 * FIFO pending queue, per-item / per-task abort via `JoinHandle.abort()`.
 */
export class WorkerPool {
  private readonly callbacks: WorkerPoolCallbacks;
  private readonly maxConcurrent: number;
  private pending: Task[] = [];
  private readonly active = new Map<TaskKey, { task: Task; handle: JoinHandle<WorkerOutbound> }>();

  constructor(concurrency: number, callbacks: WorkerPoolCallbacks) {
    this.callbacks = callbacks;
    this.maxConcurrent = Math.max(1, concurrency);
    if (!optimizerRuntimeInited) {
      try {
        initRuntime({ maxWorkers: this.maxConcurrent });
      } catch {
        /* pool already configured (e.g. tests creating a second pool) */
      }
      optimizerRuntimeInited = true;
    }
  }

  addTask(task: Task): void {
    this.pending.push(task);
    this.pump();
  }

  removeTasksForItem(id: string): void {
    this.pending = this.pending.filter(t => t.id !== id);
  }

  abortInFlightForItem(id: string): void {
    this.removeTasksForItem(id);
    for (const [key, entry] of this.active) {
      if (entry.task.id === id) {
        entry.handle.abort();
        this.active.delete(key);
        this.callbacks.onCancelled?.(id);
      }
    }
    this.pump();
  }

  cancelTask(taskId: string): void {
    this.pending = this.pending.filter(t => `${t.id}:${t.format}` !== taskId);
    for (const [key, entry] of this.active) {
      if (`${entry.task.id}:${entry.task.format}` === taskId) {
        entry.handle.abort();
        this.active.delete(key);
        this.callbacks.onCancelled?.(taskId);
      }
    }
    this.pump();
  }

  destroy(): void {
    this.pending.length = 0;
    for (const { handle } of this.active.values()) {
      handle.abort();
    }
    this.active.clear();
    shutdown();
    optimizerRuntimeInited = false;
  }

  private pump(): void {
    while (this.active.size < this.maxConcurrent && this.pending.length > 0) {
      const task = this.pending.shift()!;
      const key = taskKey(task);
      const handle = spawn(move(task), async (t: Task) => {
        const { runOptimizeTask } = await import('./optimize-task-core.ts');
        return runOptimizeTask({ id: t.id, file: t.file, options: t.options });
      });
      this.active.set(key, { task, handle });
      void this.runTask(key, task, handle);
    }
  }

  private async runTask(key: TaskKey, task: Task, handle: JoinHandle<WorkerOutbound>): Promise<void> {
    try {
      const res = await handle.join();
      if (res.ok) {
        this.callbacks.onMessage(0, res.value);
      } else {
        this.callbacks.onError(0, task);
      }
    } catch {
      this.callbacks.onError(0, task);
    } finally {
      this.active.delete(key);
      this.pump();
    }
  }
}
