import type { Task, WorkerOutbound } from './queue/types';
import {
  PRIORITY_LANE_EXPRESS_MAX_SIZE,
  PRIORITY_LANE_NORMAL_MAX_SIZE,
  PRIORITY_LANE_EXPRESS_WORKERS,
  PRIORITY_LANE_NORMAL_WORKERS,
  PRIORITY_LANE_SLOW_WORKERS,
  PRIORITY_QUEUE_MAX_PENDING,
} from '../constants/index.js';

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

interface Lane {
  queue: Task[];
  workers: WorkerSlot[];
  maxSize: number;
}

export interface AddTaskResult {
  lane: 'express' | 'normal' | 'slow';
  queued: boolean;
  position?: number;
}

export class PriorityWorkerPool {
  private lanes: Record<'express' | 'normal' | 'slow', Lane>;
  private callbacks: WorkerPoolCallbacks;
  private workerUrl: URL;

  constructor(workerUrl: URL, callbacks: WorkerPoolCallbacks) {
    this.callbacks = callbacks;
    this.workerUrl = workerUrl;
    this.lanes = {
      express: {
        queue: [],
        workers: this.createWorkers(PRIORITY_LANE_EXPRESS_WORKERS),
        maxSize: PRIORITY_LANE_EXPRESS_MAX_SIZE,
      },
      normal: {
        queue: [],
        workers: this.createWorkers(PRIORITY_LANE_NORMAL_WORKERS),
        maxSize: PRIORITY_LANE_NORMAL_MAX_SIZE,
      },
      slow: {
        queue: [],
        workers: this.createWorkers(PRIORITY_LANE_SLOW_WORKERS),
        maxSize: Infinity,
      },
    };
  }

  private createWorkers(count: number): WorkerSlot[] {
    const slots: WorkerSlot[] = [];
    for (let i = 0; i < count; i++) {
      slots.push(this.createSlot(i));
    }
    return slots;
  }

  private createSlot(index: number): WorkerSlot {
    const worker = new Worker(this.workerUrl, { type: 'module' });
    worker.onmessage = (e: MessageEvent) => this.handleMessage(index, e);
    worker.onerror = () => this.handleError(index);
    return { worker, idle: true, currentTask: null };
  }

  private getLaneForTask(task: Task): 'express' | 'normal' | 'slow' {
    const size = task.file.size;
    if (size < PRIORITY_LANE_EXPRESS_MAX_SIZE) return 'express';
    if (size < PRIORITY_LANE_NORMAL_MAX_SIZE) return 'normal';
    return 'slow';
  }

  addTask(task: Task): AddTaskResult {
    const laneName = this.getLaneForTask(task);
    const lane = this.lanes[laneName];
    if (lane.queue.length >= PRIORITY_QUEUE_MAX_PENDING) {
      return {
        lane: laneName,
        queued: true,
        position: lane.queue.length,
      };
    }
    lane.queue.push(task);
    this.drainLane(laneName);
    return {
      lane: laneName,
      queued: false,
    };
  }

  removeTasksForItem(id: string): void {
    for (const lane of Object.values(this.lanes)) {
      lane.queue = lane.queue.filter(t => t.id !== id);
    }
  }

  abortInFlightForItem(id: string): void {
    this.removeTasksForItem(id);
    for (const lane of Object.values(this.lanes)) {
      for (let i = 0; i < lane.workers.length; i++) {
        const slot = lane.workers[i];
        if (slot && slot.currentTask?.id === id) {
          this.respawnSlot(lane, i);
          this.callbacks.onCancelled?.(id);
        }
      }
    }
  }

  private respawnSlot(lane: Lane, index: number): void {
    const slot = lane.workers[index];
    if (slot) {
      slot.worker.terminate();
    }
    lane.workers[index] = this.createSlot(index);
  }

  private handleMessage(_workerIndex: number, e: MessageEvent): void {
    const slot = this.findSlotByWorkerIndex();
    if (!slot) return;
    
    const data = e.data as WorkerOutbound;
    const task = slot.currentTask;
    
    slot.currentTask = null;
    slot.idle = true;
    
    if (data.type === 'ERROR' && task) {
      this.callbacks.onError(_workerIndex, task);
    } else {
      this.callbacks.onMessage(_workerIndex, data);
    }
    
    this.drainAllLanes();
  }

  private handleError(workerIndex: number): void {
    const slot = this.findSlotByWorkerIndex();
    if (!slot) return;
    const task = slot.currentTask;
    slot.currentTask = null;
    slot.idle = true;
    this.callbacks.onError(workerIndex, task);
    this.drainAllLanes();
  }

  private findSlotByWorkerIndex(): WorkerSlot | null {
    for (const lane of Object.values(this.lanes)) {
      for (const slot of lane.workers) {
        if (slot.worker === globalThis.event?.target) {
          return slot;
        }
      }
    }
    return null;
  }

  private drainLane(laneName: 'express' | 'normal' | 'slow'): void {
    const lane = this.lanes[laneName];
    
    for (const slot of lane.workers) {
      if (slot.idle && lane.queue.length > 0) {
        const task = lane.queue.shift()!;
        slot.currentTask = task;
        slot.idle = false;
        slot.worker.postMessage({
          id: task.id,
          file: task.file,
          options: task.options,
        });
      }
    }
  }

  private drainAllLanes(): void {
    this.drainLane('express');
    this.drainLane('normal');
    this.drainLane('slow');
  }

  getPendingCount(): number {
    return (
      this.lanes.express.queue.length +
      this.lanes.normal.queue.length +
      this.lanes.slow.queue.length
    );
  }

  destroy(): void {
    for (const lane of Object.values(this.lanes)) {
      for (const slot of lane.workers) {
        slot.worker.terminate();
      }
      lane.queue = [];
    }
  }
}