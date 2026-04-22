/**
 * Optimizer concurrency via Native Web Worker Pool.
 * Features 0-copy ArrayBuffer transfers, dynamic staggered scaling,
 * and immediate Web Worker termination on cancel.
 */

import type { Task, TaskOptions, WorkerOutbound } from '@/lib/queue/types';
import { CONCURRENCY_MIN } from '@/constants/limits';
import optimizerWorkerUrl from './optimizer.worker.ts?worker&url';
import { computeOptimalWorkerCount } from '@/capabilities/worker-count';
import { findTransferable } from './transferable';
import { DYNAMIC_SCALE_DELAY_MS, MIN_WORKER_STAGGER_MS, WORKER_IDLE_TIMEOUT_MS } from '@/constants/worker';

type OptimizePayload = { id: string; file: File | Blob; options: TaskOptions };

export interface WorkerPoolCallbacks {
  onMessage: (workerIndex: number, data: WorkerOutbound) => void;
  onError: (workerIndex: number, task: Task | null) => void;
  onCancelled?: (taskKey: string) => void;
  onActiveCountChange?: (count: number) => void;
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

interface WorkerEntry {
  worker: Worker;
  idleTimeoutId?: ReturnType<typeof setTimeout>;
}

export class WorkerPool {
  private readonly callbacks: WorkerPoolCallbacks;
  private minConcurrent: number;
  private maxConcurrent: number;
  private pending: Task[] = [];
  private readonly active = new Map<TaskKey, { task: Task; controller: AbortController }>();

  private isPumping = false;
  private lastWorkerCreatedMs = 0;
  private pumpTimeoutId?: ReturnType<typeof setTimeout>;

  private idleWorkers: WorkerEntry[] = [];
  private activeWorkers = new Map<TaskKey, WorkerEntry>();
  private allWorkers = new Set<WorkerEntry>();

  constructor(concurrency: number, callbacks: WorkerPoolCallbacks) {
    this.callbacks = callbacks;
    const { min, max } = dynamicPoolBounds(concurrency);
    this.minConcurrent = min;
    this.maxConcurrent = max;
  }

  get activeCount(): number {
    return this.active.size;
  }

  get concurrencyLimit(): number {
    return this.maxConcurrent;
  }

  setConcurrencyLimit(limit: number): void {
    const { min, max } = dynamicPoolBounds(limit);
    this.minConcurrent = min;
    this.maxConcurrent = max;
    this.callbacks.onActiveCountChange?.(this.activeCount);
  }

  private notifyActiveChange() {
    this.callbacks.onActiveCountChange?.(this.activeCount);
  }

  addTask(task: Task): void {
    this.pending.push(task);
    void this.pump();
  }

  removeTasksForItem(id: string): void {
    this.pending = this.pending.filter(t => t.id !== id);
  }

  private terminateWorkerForTask(key: TaskKey) {
    const entry = this.activeWorkers.get(key);
    if (entry) {
      entry.worker.terminate();
      this.activeWorkers.delete(key);
      this.allWorkers.delete(entry);
    }
  }

  abortInFlightForItem(id: string): void {
    this.removeTasksForItem(id);
    let changed = false;
    for (const [key, entry] of this.active) {
      if (entry.task.id === id) {
        this.terminateWorkerForTask(key);
        entry.controller.abort();
        this.active.delete(key);
        this.callbacks.onCancelled?.(key);
        changed = true;
      }
    }
    if (changed) this.notifyActiveChange();
    void this.pump();
  }

  cancelTask(taskId: string): void {
    this.pending = this.pending.filter(t => `${t.id}:${t.resultId}` !== taskId);
    let changed = false;
    for (const [key, entry] of this.active) {
      if (`${entry.task.id}:${entry.task.resultId}` === taskId) {
        this.terminateWorkerForTask(key);
        entry.controller.abort();
        this.active.delete(key);
        this.callbacks.onCancelled?.(taskId);
        changed = true;
      }
    }
    if (changed) this.notifyActiveChange();
    void this.pump();
  }

  async destroy(): Promise<void> {
    clearTimeout(this.pumpTimeoutId);
    this.pending.length = 0;
    for (const { controller } of this.active.values()) {
      controller.abort();
    }
    this.active.clear();
    
    for (const entry of this.allWorkers) {
      clearTimeout(entry.idleTimeoutId);
      entry.worker.terminate();
    }
    this.allWorkers.clear();
    this.idleWorkers.length = 0;
    this.activeWorkers.clear();
  }

  private releaseWorker(entry: WorkerEntry) {
    if (this.allWorkers.has(entry)) {
      entry.idleTimeoutId = setTimeout(() => {
        if (this.allWorkers.has(entry)) {
          entry.worker.terminate();
          this.allWorkers.delete(entry);
          this.idleWorkers = this.idleWorkers.filter(e => e !== entry);
        }
      }, WORKER_IDLE_TIMEOUT_MS);
      this.idleWorkers.push(entry);
    }
  }

  private async pump(): Promise<void> {
    if (this.isPumping) return;
    this.isPumping = true;

    try {
      while (this.active.size < this.maxConcurrent && this.pending.length > 0) {
        if (this.idleWorkers.length === 0) {
          const now = Date.now();
          const elapsed = now - this.lastWorkerCreatedMs;
          if (this.allWorkers.size < this.minConcurrent) {
            // Ramping up to MIN workers: stagger slightly to keep main thread fluid
            const delay = MIN_WORKER_STAGGER_MS - elapsed;
            if (delay > 0) await new Promise(r => setTimeout(r, delay));
          } else {
            // Dynamic scale up: wait longer to give busy workers a chance to finish
            const delay = DYNAMIC_SCALE_DELAY_MS - elapsed;
            if (delay > 0) {
              await new Promise(r => setTimeout(r, delay));
              this.pumpTimeoutId = setTimeout(() => { void this.pump(); }, DYNAMIC_SCALE_DELAY_MS);
              return; // Exit pump. If a worker finishes, it will resume automatically.
            }
          }
        }

        if (this.pending.length === 0) break;

        const task = this.pending.shift()!;
        const key = taskKey(task);
        const controller = new AbortController();
        this.active.set(key, { task, controller });
        this.notifyActiveChange();

        let workerEntry: WorkerEntry;
        if (this.idleWorkers.length > 0) {
          workerEntry = this.idleWorkers.pop()!;
          clearTimeout(workerEntry.idleTimeoutId);
        } else {
          this.lastWorkerCreatedMs = Date.now();
          const worker = new Worker(optimizerWorkerUrl, { type: 'module' });
          workerEntry = { worker };
          this.allWorkers.add(workerEntry);
        }

        // Handle case where task was aborted while awaiting delay
        if (!this.active.has(key)) {
          this.releaseWorker(workerEntry);
          continue;
        }

        this.activeWorkers.set(key, workerEntry);

        const payload: OptimizePayload = {
          id: task.id,
          file: task.file,
          options: task.options,
        };

        const cleanup = () => {
          workerEntry.worker.removeEventListener('message', handleMessage);
          workerEntry.worker.removeEventListener('error', handleError);
          this.activeWorkers.delete(key);
          const hadTask = this.active.delete(key);
          if (hadTask) this.notifyActiveChange();
        };

        const handleMessage = (e: MessageEvent) => {
          cleanup();
          this.releaseWorker(workerEntry);
          this.callbacks.onMessage(0, e.data);
          void this.pump();
        };

        const handleError = () => {
          cleanup();
          workerEntry.worker.terminate();
          this.allWorkers.delete(workerEntry);
          this.callbacks.onError(0, task);
          void this.pump();
        };

        workerEntry.worker.addEventListener('message', handleMessage);
        workerEntry.worker.addEventListener('error', handleError);

        try {
          const transferList = findTransferable(payload);
          workerEntry.worker.postMessage(payload, transferList);
        } catch (err) {
          console.error('Failed to postMessage to worker', err);
          handleError();
        }
      }
    } finally {
      this.isPumping = false;
    }
  }
}
