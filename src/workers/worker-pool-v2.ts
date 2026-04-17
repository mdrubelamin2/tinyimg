/**
 * Optimizer concurrency via poolifier-web-worker DynamicThreadPool + ThreadWorker.
 * Preserves cancel + pending-queue semantics of the previous WorkerPool.
 */

import { DynamicThreadPool } from 'poolifier-web-worker';
import type { Task, TaskOptions, WorkerOutbound } from '@/lib/queue/types.ts';
import { CONCURRENCY_MIN } from '@/constants/limits';
import optimizerPoolifierWorkerUrl from './optimizer-poolifier.worker.ts?worker&url';
import { computeOptimalWorkerCount } from '@/capabilities/worker-count';

type OptimizePayload = { id: string; file: File; options: TaskOptions };

export interface WorkerPoolCallbacks {
  onMessage: (workerIndex: number, data: WorkerOutbound) => void;
  onError: (workerIndex: number, task: Task | null) => void;
  onCancelled?: (taskKey: string) => void;
}

export function computeConcurrency(): number {
  return computeOptimalWorkerCount();
}

type TaskKey = string;

function taskKey(task: Task): TaskKey {
  return `${task.id}:${task.resultId}`;
}

function dynamicPoolBounds(maxWorkers: number): { min: number; max: number } {
  const max = Math.max(1, maxWorkers);
  if (max === 1) return { min: 0, max: 1 };
  let min = Math.max(1, CONCURRENCY_MIN);
  if (min >= max) min = Math.max(0, max - 1);
  return { min, max };
}

export class WorkerPool {
  private readonly callbacks: WorkerPoolCallbacks;
  private readonly maxConcurrent: number;
  private readonly pool: DynamicThreadPool<OptimizePayload, WorkerOutbound>;
  private pending: Task[] = [];
  private readonly active = new Map<TaskKey, { task: Task; controller: AbortController }>();

  constructor(concurrency: number, callbacks: WorkerPoolCallbacks) {
    this.callbacks = callbacks;
    this.maxConcurrent = Math.max(1, concurrency);
    const { min, max } = dynamicPoolBounds(this.maxConcurrent);
    this.pool = new DynamicThreadPool(min, max, optimizerPoolifierWorkerUrl, {
      errorEventHandler: (e) => {
        console.error(e);
      },
    });
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
        entry.controller.abort();
        this.active.delete(key);
        this.callbacks.onCancelled?.(key);
      }
    }
    this.pump();
  }

  cancelTask(taskId: string): void {
    this.pending = this.pending.filter(t => `${t.id}:${t.resultId}` !== taskId);
    for (const [key, entry] of this.active) {
      if (`${entry.task.id}:${entry.task.resultId}` === taskId) {
        entry.controller.abort();
        this.active.delete(key);
        this.callbacks.onCancelled?.(taskId);
      }
    }
    this.pump();
  }

  destroy(): void {
    this.pending.length = 0;
    for (const { controller } of this.active.values()) {
      controller.abort();
    }
    this.active.clear();
    void this.pool.destroy();
  }

  private pump(): void {
    while (this.active.size < this.maxConcurrent && this.pending.length > 0) {
      const task = this.pending.shift()!;
      const key = taskKey(task);
      const controller = new AbortController();
      this.active.set(key, { task, controller });
      const payload: OptimizePayload = {
        id: task.id,
        file: task.file,
        options: task.options,
      };
      void this.pool
        .execute(payload, undefined, controller.signal)
        .then((data) => {
          this.callbacks.onMessage(0, data);
        })
        .catch((err: unknown) => {
          const aborted =
            controller.signal.aborted ||
            (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted')));
          if (aborted) return;
          this.callbacks.onError(0, task);
        })
        .finally(() => {
          this.active.delete(key);
          this.pump();
        });
    }
  }
}
