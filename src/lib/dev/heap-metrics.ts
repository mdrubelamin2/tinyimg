/**
 * Dev-only helpers for investigating main-thread spikes around worker RESULT
 * persistence. No-op in production builds (`import.meta.env.PROD`).
 *
 * Chrome: Memory > Heap snapshot (filter Detached / ArrayBuffer). Performance
 * > record with "Memory" checked, then inspect allocation stacks on
 * `persistEncodedOutput` / `createObjectUrlForStoredPayload`.
 */

const enabled = import.meta.env.DEV;

let concurrentPersistPipelines = 0;
let peakResultBatchCount = 0;
let peakResultBatchBytes = 0;

function log(...args: unknown[]): void {
  if (enabled) console.info('[heap-metrics]', ...args);
}

export const heapMetrics = {
  /** Logged when a RAF flush sees N RESULT messages before persistence. */
  resultBatchReceived(count: number, totalEncodedBytes: number): void {
    if (!enabled) return;
    peakResultBatchCount = Math.max(peakResultBatchCount, count);
    peakResultBatchBytes = Math.max(peakResultBatchBytes, totalEncodedBytes);
    if (count > 1 || totalEncodedBytes > 512 * 1024) {
      log('RESULT batch', { count, totalEncodedBytes, peakResultBatchCount, peakResultBatchBytes });
    }
  },

  persistPipelineEnter(): void {
    if (!enabled) return;
    concurrentPersistPipelines++;
    if (concurrentPersistPipelines > 1) {
      console.warn('[heap-metrics] overlapping persist pipelines', concurrentPersistPipelines);
    }
  },

  persistPipelineExit(): void {
    if (!enabled) return;
    concurrentPersistPipelines = Math.max(0, concurrentPersistPipelines - 1);
  },

  persistDurationMs(ms: number, payloadBytes: number): void {
    if (!enabled) return;
    if (ms > 32 || payloadBytes > 2 * 1024 * 1024) {
      log('persist', { ms: Math.round(ms * 10) / 10, payloadBytes });
    }
  },
};
