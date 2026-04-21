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
  // 1. Prioritize Explicit "Desktop Mode" / Chrome Signal
  // This is the only way to catch mobile devices asking to look like desktops
  // @ts-expect-error: userAgentData is a modern API not yet in all TS lib definitions
  if (navigator.userAgentData?.mobile) return true;

  // 2. Identify "Coarse" Input (Finger/Stylus)
  // This captures touch laptops, iPads, and phones
  const hasTouchScreen = window.matchMedia("(any-pointer: coarse)").matches;
  
  // 3. Size Heuristic
  const isSmallScreen = window.innerWidth <= 1024;

  // We return true if they HAVE touch capability AND (small screen OR mobile OS)
  // This correctly excludes Touch Laptops with large screens and no mobile UA.
  return hasTouchScreen && (isSmallScreen || checkIsMobileByUA());
}

function checkIsMobileByUA(): boolean {
  const { userAgent, platform, maxTouchPoints } = window.navigator;

  // Standard regex for Android/iOS
  const isHandheld = /android|iphone|ipod|ipad/i.test(userAgent.toLowerCase());

  // The "iPadOS" desktop-mode workaround
  const isIpadOS = platform === 'iPad' || (platform === 'MacIntel' && maxTouchPoints > 0);

  return isHandheld || isIpadOS;
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
