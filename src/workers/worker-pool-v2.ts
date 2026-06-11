/**
 * Optimizer concurrency via Native Web Worker Pool.
 * Features 0-copy ArrayBuffer transfers, dynamic staggered scaling,
 * and immediate Web Worker termination on cancel.
 */

import * as Comlink from 'comlink'

import type { Task, TaskOptions, WorkerOutbound } from '@/lib/queue/types'

import { computeOptimalWorkerCount } from '@/capabilities/worker-count'
import { CONCURRENCY_MIN } from '@/constants/limits'
import {
  DYNAMIC_SCALE_DELAY_MS,
  MIN_WORKER_STAGGER_MS,
  WORKER_IDLE_TIMEOUT_MS,
} from '@/constants/worker'

import optimizerWorkerUrl from './optimizer.worker.ts?worker&url'

export interface OptimizePayload {
  file: File
  id: string
  options: TaskOptions
  sourceBuffer?: ArrayBuffer | undefined
}

export interface OptimizerAPI {
  optimize(payload: OptimizePayload): Promise<WorkerOutbound>
  preloadWasm(): Promise<void>
}

export interface WorkerPoolCallbacks {
  onActiveCountChange?: (count: number) => void
  onCancelled?: (taskKey: string) => void
  onError: (workerIndex: number, task: null | Task) => void
  onMessage: (workerIndex: number, data: WorkerOutbound) => void
}

type TaskKey = string

interface WorkerEntry {
  channel?: MessageChannel
  idleTimeoutId?: ReturnType<typeof setTimeout>
  proxy?: Comlink.Remote<OptimizerAPI>
  proxyReady?: Promise<void>
  worker: Worker
}

export class WorkerPool {
  get activeCount(): number {
    return this.active.size
  }
  get concurrencyLimit(): number {
    return this.maxConcurrent
  }
  private readonly active = new Map<
    TaskKey,
    { controller: AbortController; retried?: boolean; task: Task }
  >()
  private activeWorkers = new Map<TaskKey, WorkerEntry>()
  private allWorkers = new Set<WorkerEntry>()

  private readonly callbacks: WorkerPoolCallbacks
  private idleWorkers: WorkerEntry[] = []
  private isPumping = false

  private lastWorkerCreatedMs = Date.now()
  private maxConcurrent: number
  private minConcurrent: number

  private pending: Task[] = []

  private pumpTimeoutId?: ReturnType<typeof setTimeout>

  constructor(concurrency: number, callbacks: WorkerPoolCallbacks) {
    this.callbacks = callbacks
    const { max, min } = dynamicPoolBounds(concurrency)
    this.minConcurrent = min
    this.maxConcurrent = max
  }

  abortInFlightForItem(id: string): void {
    this.removeTasksForItem(id)
    let changed = false
    for (const [key, entry] of this.active) {
      if (entry.task.id === id) {
        this.releaseWorkerForTask(key)
        entry.controller.abort()
        this.active.delete(key)
        this.callbacks.onCancelled?.(key)
        changed = true
      }
    }
    if (changed) this.notifyActiveChange()
    void this.pump()
  }

  addTask(task: Task): void {
    this.pending.push(task)
    void this.pump()
  }

  cancelTask(taskId: string): void {
    this.pending = this.pending.filter((t) => `${t.id}:${t.resultId}` !== taskId)
    let changed = false
    for (const [key, entry] of this.active) {
      if (`${entry.task.id}:${entry.task.resultId}` === taskId) {
        this.releaseWorkerForTask(key)
        entry.controller.abort()
        this.active.delete(key)
        this.callbacks.onCancelled?.(taskId)
        changed = true
      }
    }
    if (changed) this.notifyActiveChange()
    void this.pump()
  }

  async destroy(): Promise<void> {
    clearTimeout(this.pumpTimeoutId)
    this.pending.length = 0
    for (const entry of this.active.values()) {
      entry.controller.abort()
    }
    this.active.clear()

    for (const entry of this.allWorkers) {
      clearTimeout(entry.idleTimeoutId)
      entry.channel?.port1.close()
      entry.worker.terminate()
    }
    this.allWorkers.clear()
    this.idleWorkers.length = 0
    this.activeWorkers.clear()
  }

  removeTasksForItem(id: string): void {
    this.pending = this.pending.filter((t) => t.id !== id)
  }

  setConcurrencyLimit(limit: number): void {
    const { max, min } = dynamicPoolBounds(limit)
    this.minConcurrent = min
    this.maxConcurrent = max
    this.callbacks.onActiveCountChange?.(this.activeCount)
  }

  async warmup(): Promise<void> {
    for (let i = 0; i < this.minConcurrent; i++) {
      this.primeWasmIdleWorker()
    }
  }

  private async ensureWorkerProxy(workerEntry: WorkerEntry): Promise<Comlink.Remote<OptimizerAPI>> {
    if (workerEntry.proxy) return workerEntry.proxy
    if (!workerEntry.proxyReady) {
      workerEntry.proxyReady = (async () => {
        const channel = new MessageChannel()
        workerEntry.channel = channel
        workerEntry.worker.postMessage({ port: channel.port2, type: 'INIT' }, [channel.port2])
        workerEntry.proxy = Comlink.wrap<OptimizerAPI>(channel.port1)
      })()
    }
    await workerEntry.proxyReady
    return workerEntry.proxy!
  }

  private notifyActiveChange() {
    this.callbacks.onActiveCountChange?.(this.activeCount)
  }

  private async primeWasmIdleWorker(): Promise<void> {
    this.lastWorkerCreatedMs = Date.now()
    const worker = new Worker(optimizerWorkerUrl, { type: 'module' })
    const workerEntry: WorkerEntry = { worker }
    this.allWorkers.add(workerEntry)

    try {
      const proxy = await this.ensureWorkerProxy(workerEntry)
      await proxy.preloadWasm()
    } catch (error) {
      worker.terminate()
      this.allWorkers.delete(workerEntry)
      throw error
    }

    this.releaseWorker(workerEntry)
  }

  private async pump(): Promise<void> {
    if (this.isPumping) return
    this.isPumping = true

    try {
      while (this.active.size < this.maxConcurrent && this.pending.length > 0) {
        if (this.idleWorkers.length > 0) {
          const workerEntry = this.idleWorkers.pop()!
          clearTimeout(workerEntry.idleTimeoutId)
          const task = this.pending.shift()!
          const key = taskKey(task)
          const controller = new AbortController()
          this.active.set(key, { controller, task })
          this.activeWorkers.set(key, workerEntry)
          this.notifyActiveChange()
          void this.runTask(key, task, workerEntry)
          continue
        }

        const now = Date.now()
        const elapsed = now - this.lastWorkerCreatedMs

        let targetDelay: null | number = null
        if (this.allWorkers.size < this.minConcurrent) {
          targetDelay = MIN_WORKER_STAGGER_MS
        } else if (this.allWorkers.size < this.maxConcurrent) {
          targetDelay = DYNAMIC_SCALE_DELAY_MS
        }

        if (targetDelay !== null && elapsed < targetDelay) {
          const delay = targetDelay - elapsed
          clearTimeout(this.pumpTimeoutId)
          this.isPumping = false
          this.pumpTimeoutId = setTimeout(() => {
            void this.pump()
          }, delay)
          return
        }

        if (this.pending.length === 0) break

        const task = this.pending.shift()!
        const key = taskKey(task)
        const controller = new AbortController()

        this.lastWorkerCreatedMs = Date.now()
        const worker = new Worker(optimizerWorkerUrl, { type: 'module' })
        const workerEntry: WorkerEntry = { worker }
        this.allWorkers.add(workerEntry)

        this.active.set(key, { controller, task })
        this.activeWorkers.set(key, workerEntry)
        this.notifyActiveChange()
        void this.runTask(key, task, workerEntry)
      }
    } finally {
      this.isPumping = false
    }
  }

  private releaseWorker(entry: WorkerEntry) {
    if (this.allWorkers.has(entry)) {
      entry.idleTimeoutId = setTimeout(() => {
        if (this.allWorkers.has(entry)) {
          entry.worker.terminate()
          this.allWorkers.delete(entry)
          this.idleWorkers = this.idleWorkers.filter((e) => e !== entry)
        }
      }, WORKER_IDLE_TIMEOUT_MS)
      this.idleWorkers.push(entry)
    }
  }

  private releaseWorkerForTask(key: TaskKey) {
    const entry = this.activeWorkers.get(key)
    if (entry) {
      this.activeWorkers.delete(key)
      this.releaseWorker(entry)
    }
  }

  private async runTask(key: TaskKey, task: Task, workerEntry: WorkerEntry): Promise<void> {
    const cleanup = () => {
      this.activeWorkers.delete(key)
      const hadTask = this.active.delete(key)
      if (hadTask) this.notifyActiveChange()
    }

    const handleError = () => {
      const activeEntry = this.active.get(key)
      if (activeEntry && !activeEntry.retried) {
        activeEntry.retried = true
        activeEntry.controller = new AbortController()
        this.terminateWorkerForTask(key)
        this.pending.unshift(task)
        void this.pump()
        return
      }
      cleanup()
      this.terminateWorkerForTask(key)
      this.callbacks.onError(0, task)
      void this.pump()
    }

    try {
      const proxy = await this.ensureWorkerProxy(workerEntry)

      const payload: OptimizePayload = {
        file: task.file,
        id: task.id,
        options: task.options,
        ...(task.sourceBuffer ? { sourceBuffer: task.sourceBuffer } : {}),
      }

      const result = task.sourceBuffer
        ? await proxy.optimize(Comlink.transfer(payload, [task.sourceBuffer]))
        : await proxy.optimize(payload)

      if (!this.active.has(key)) {
        this.releaseWorker(workerEntry)
        return
      }

      this.callbacks.onMessage(0, result)
      cleanup()
      this.releaseWorker(workerEntry)
      void this.pump()
    } catch (error) {
      if (this.active.get(key)) {
        console.error('Failed to run optimize task via Comlink', error)
        handleError()
      }
    }
  }

  private terminateWorkerForTask(key: TaskKey) {
    const entry = this.activeWorkers.get(key)
    if (entry) {
      clearTimeout(entry.idleTimeoutId)
      entry.channel?.port1.close()
      entry.worker.terminate()
      this.activeWorkers.delete(key)
      this.allWorkers.delete(entry)
      this.idleWorkers = this.idleWorkers.filter((e) => e !== entry)
    }
  }
}

export function computeConcurrency(): number {
  return computeOptimalWorkerCount()
}

function dynamicPoolBounds(maxWorkers: number): { max: number; min: number } {
  const max = Math.max(1, maxWorkers)
  if (max === 1) return { max: 1, min: 0 }
  let min = Math.max(1, CONCURRENCY_MIN)
  if (min >= max) min = Math.max(0, max - 1)
  return { max, min }
}

function taskKey(task: Task): TaskKey {
  return `${task.id}:${task.resultId}`
}
