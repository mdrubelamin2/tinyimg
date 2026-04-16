/**
 * Dynamic Web Worker pool sizing from CPU, device memory, and form-factor.
 * Avoids hard-capping throughput on high-core machines while staying conservative on mobile.
 */

import {
  CONCURRENCY_MIN,
  CONCURRENCY_MAX_DESKTOP,
  MOBILE_MAX_WORKERS,
  MB_PER_WORKER_ESTIMATE,
  DEVICE_MEMORY_RESERVE_GB,
} from '@/constants/limits';

function isCoarsePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function isLikelyMobile(): boolean {
  return isCoarsePointer() || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 2);
}

/**
 * Heuristic memory-based cap: assume ~MB_PER_WORKER_ESTIMATE MB per active WASM worker.
 */
function memoryBasedMaxWorkers(): number {
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (dm == null || !Number.isFinite(dm)) {
    return CONCURRENCY_MAX_DESKTOP;
  }
  const usableGb = Math.max(0, dm - DEVICE_MEMORY_RESERVE_GB);
  const cap = Math.floor((usableGb * 1024) / MB_PER_WORKER_ESTIMATE);
  return Math.max(CONCURRENCY_MIN, Math.min(CONCURRENCY_MAX_DESKTOP, cap));
}

/**
 * Returns the number of optimizer workers to spawn (main thread stays reserved).
 */
export function computeOptimalWorkerCount(): number {
  const cores = navigator.hardwareConcurrency ?? 4;
  if (cores <= 2) return 1;

  if (isLikelyMobile()) {
    const reserved = 1;
    return Math.max(1, Math.min(cores - reserved, MOBILE_MAX_WORKERS));
  }

  const reserved = cores > 6 ? 2 : 1;
  const coreCap = Math.max(1, cores - reserved);
  return Math.max(CONCURRENCY_MIN, Math.min(coreCap, memoryBasedMaxWorkers()));
}
