import { QUOTA_WARN_RATIO } from '@/constants/storage';
import { toastWarning } from '@/notifications/toast-emitter';

/** True when a storage write failed because quota was exceeded (OPFS / IndexedDB). */
export function isQuotaExceededError(e: unknown): boolean {
  if (e == null) return false;
  if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
    return e.name === 'QuotaExceededError' || e.code === 22;
  }
  if (e instanceof Error) return e.name === 'QuotaExceededError';
  return false;
}

/** Proactive pre-write quota check. */
export async function checkQuotaBeforeWrite(bytes: number): Promise<'ok' | 'warn' | 'full'> {
  const est = await navigator.storage?.estimate?.();
  if (!est?.quota) return 'ok';
  const ratio = ((est.usage ?? 0) + bytes) / est.quota;
  if (ratio >= 1) return 'full';
  if (ratio >= QUOTA_WARN_RATIO) return 'warn';
  return 'ok';
}

/** Request persistent storage (eviction protection). */
export async function requestPersistence(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}

const DEFAULT_INTERVAL_MS = 45_000;

/** Periodically checks StorageManager usage; warns once per threshold crossing. */
export function startSessionQuotaMonitor(intervalMs: number = DEFAULT_INTERVAL_MS): () => void {
  let warned = false;
  const id = window.setInterval(async () => {
    if (!navigator.storage?.estimate) return;
    try {
      const { usage = 0, quota } = await navigator.storage.estimate();
      if (!quota || quota <= 0) return;
      const ratio = usage / quota;
      if (ratio >= QUOTA_WARN_RATIO && !warned) {
        warned = true;
        toastWarning(
          `Browser storage is ${Math.round(ratio * 100)}% full. Download results and clear the queue to free space.`
        );
      }
      if (ratio < QUOTA_WARN_RATIO * 0.85) {
        warned = false;
      }
    } catch {
      /* noop */
    }
  }, intervalMs);
  return () => window.clearInterval(id);
}
