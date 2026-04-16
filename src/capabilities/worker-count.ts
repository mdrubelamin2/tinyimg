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
import { availableParallelism } from 'poolifier-web-worker';

function isLikelyMobile(): boolean {
  const { userAgent, platform, maxTouchPoints } = window.navigator;

  const isIOS = /(iphone|ipod|ipad)/i.test(userAgent);

  // Workaround for ipadOS, force detection as tablet. `platform` is
  // deprecated but remains the only reliable way to distinguish iPadOS
  // desktop-mode (MacIntel + touch) from a real Mac on Safari/Firefox.
  // Known limitation: if Apple ever ships a touch-screen Mac, it will
  // also match `MacIntel + maxTouchPoints > 0` and be misclassified as
  // iPad here. No such device exists today; revisit when/if it ships.
  // SEE: https://github.com/lancedikson/bowser/issues/329
  // SEE: https://stackoverflow.com/questions/58019463/how-to-detect-device-name-in-safari-on-ios-13-while-it-doesnt-show-the-correct
  const isIpad =
    platform === 'iPad' || (platform === 'MacIntel' && maxTouchPoints > 0);

  const isAndroid = /android/i.test(userAgent);

  return isIOS || isIpad || isAndroid;
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
  const cores = availableParallelism();
  if (cores <= 2) return 1;

  if (isLikelyMobile()) {
    const reserved = 1;
    return Math.max(1, Math.min(cores - reserved, MOBILE_MAX_WORKERS));
  }

  const reserved = cores > 6 ? 2 : 1;
  const coreCap = Math.max(1, cores - reserved);
  return Math.max(CONCURRENCY_MIN, Math.min(coreCap, memoryBasedMaxWorkers()));
}
