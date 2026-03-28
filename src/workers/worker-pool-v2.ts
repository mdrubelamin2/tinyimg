/**
 * Worker pool v2: typed protocol, task cancellation via terminate + respawn,
 * per-item abort, and memory-aware task assignment.
 */

import type { Task, WorkerOutbound } from '@/lib/queue/types.ts';
import { CONCURRENCY_MIN, CONCURRENCY_MAX, CONCURRENCY_DEFAULT } from '@/constants/index.ts';

export interface WorkerPoolCallbacks {
  onMessage: (workerIndex: number, data: WorkerOutbound) => void;
  onError: (workerIndex: number, task: Task | null) => void;
  onCancelled?: (taskId: string) => void;
}

interface WorkerSlot {
  worker: Worker;
  idle: boolean;
  currentTask: Task | null;
}

export function computeConcurrency(): number {
  const cores = navigator.hardwareConcurrency ?? CONCURRENCY_DEFAULT;
  return Math.min(
    Math.max(cores > 1 ? cores - 1 : 1, CONCURRENCY_MIN),
    CONCURRENCY_MAX
  );
}

/**
 * Pool of Web Workers with typed protocol and cancellation support.
 * Cancellation uses the terminate + respawn pattern (proven by PicShift).
 */
export class WorkerPool {
  private readonly slots: WorkerSlot[] = [];
  private taskQueue: Task[] = [];
  private readonly callbacks: WorkerPoolCallbacks;
  private readonly workerUrl: URL;

  constructor(
    workerUrl: URL,
    concurrency: number,
    callbacks: WorkerPoolCallbacks
  ) {
    this.callbacks = callbacks;
    this.workerUrl = workerUrl;

    for (let i = 0; i < concurrency; i++) {
      this.slots.push(this.createSlot(i));
    }
  }

  private createSlot(index: number): WorkerSlot {
    const worker = new Worker(this.workerUrl, { type: 'module' });
    worker.onmessage = (e: MessageEvent) => this.handleMessage(index, e);
    worker.onerror = () => this.handleError(index);
    return { worker, idle: true, currentTask: null };
  }

  private respawnSlot(index: number): void {
    const slot = this.slots[index];
    if (slot) {
      slot.worker.terminate();
    }
    this.slots[index] = this.createSlot(index);
  }

  /** Add a task to the queue; assigns to an idle worker if available. */
  addTask(task: Task): void {
    this.taskQueue.push(task);
    this.drainTaskQueue();
  }

  /** Remove all pending (not in-flight) tasks for a given item id. */
  removeTasksForItem(id: string): void {
    this.taskQueue = this.taskQueue.filter(t => t.id !== id);
  }

  /**
   * Cancel in-flight work for an item: terminate the worker processing it, respawn.
   * Also removes any pending tasks for that item.
   */
  abortInFlightForItem(id: string): void {
    this.removeTasksForItem(id);

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot && slot.currentTask?.id === id) {
        this.respawnSlot(i);
        this.callbacks.onCancelled?.(id);
      }
    }
  }

  /** Cancel a specific task by taskId (format-level granularity). */
  cancelTask(taskId: string): void {
    this.taskQueue = this.taskQueue.filter(t =>
      `${t.id}:${t.format}` !== taskId
    );

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot?.currentTask && `${slot.currentTask.id}:${slot.currentTask.format}` === taskId) {
        this.respawnSlot(i);
        this.callbacks.onCancelled?.(taskId);
      }
    }
  }

  /** Terminate all workers. */
  destroy(): void {
    for (const slot of this.slots) {
      slot.worker.terminate();
    }
    this.taskQueue = [];
  }

  private handleMessage(workerIndex: number, e: MessageEvent): void {
    const slot = this.slots[workerIndex];
    if (!slot) return;
    slot.currentTask = null;
    slot.idle = true;
    this.callbacks.onMessage(workerIndex, e.data as WorkerOutbound);
    this.assignNextTask(workerIndex);
  }

  private handleError(workerIndex: number): void {
    const slot = this.slots[workerIndex];
    if (!slot) return;
    const task = slot.currentTask;
    slot.currentTask = null;
    slot.idle = true;
    this.callbacks.onError(workerIndex, task);
    this.assignNextTask(workerIndex);
  }

  private assignNextTask(workerIndex: number): void {
    if (this.taskQueue.length === 0) return;
    const slot = this.slots[workerIndex];
    if (!slot) return;
    const task = this.taskQueue.shift()!;
    slot.currentTask = task;
    slot.idle = false;
    slot.worker.postMessage({
      id: task.id,
      file: task.file,
      options: task.options,
    });
  }

  private drainTaskQueue(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot?.idle && this.taskQueue.length > 0) {
        this.assignNextTask(i);
      }
    }
  }
}
