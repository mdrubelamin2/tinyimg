/**
 * Dynamic Web Worker pool sizing from CPU, device memory, and form-factor.
 * Avoids hard-capping throughput on high-core machines while staying conservative on mobile.
 */

import {
  CONCURRENCY_MIN,
  CONCURRENCY_MAX_DESKTOP,
  CONCURRENCY_MAX_NO_DEVICE_MEMORY,
  MOBILE_MAX_WORKERS,
  MB_PER_WORKER_ESTIMATE,
  DEVICE_MEMORY_RESERVE_GB,
  BYTES_PER_KB,
} from '@/constants/limits';

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
 * When `navigator.deviceMemory` is available (Chromium), cap concurrent optimizer
 * workers so rough WASM footprint × N stays below (reported GiB − reserve).
 */
function memoryBoundedWorkerCap(maxByCores: number): number {
  const nav = globalThis.navigator as Navigator & { deviceMemory?: number };
  const dm = nav.deviceMemory;
  if (dm == null || !Number.isFinite(dm) || dm <= 0) {
    return Math.min(maxByCores, CONCURRENCY_MAX_NO_DEVICE_MEMORY);
  }

  const budgetGb = Math.max(0.5, dm - DEVICE_MEMORY_RESERVE_GB);
  const budgetMb = budgetGb * BYTES_PER_KB;
  const byMem = Math.max(1, Math.floor(budgetMb / MB_PER_WORKER_ESTIMATE));
  return Math.min(maxByCores, byMem);
}

/**
 * Returns the number of optimizer workers to spawn (main thread stays reserved).
 */
export function computeOptimalWorkerCount(): number {
  const cores = CONCURRENCY_MAX_DESKTOP;
  if (cores <= 2) return 1;

  if (isLikelyMobile()) {
    const n = Math.max(1, Math.min(cores, MOBILE_MAX_WORKERS));
    return memoryBoundedWorkerCap(n);
  }

  const n = Math.max(CONCURRENCY_MIN, Math.min(cores, CONCURRENCY_MAX_DESKTOP));
  return memoryBoundedWorkerCap(n);
}
