import { QUOTA_WARN_RATIO } from '@/constants/storage';
import { toastWarning } from '@/notifications/toast-emitter';

const DEFAULT_INTERVAL_MS = 45_000;

/**
 * Periodically checks StorageManager usage; warns once per threshold crossing.
 */
export function startSessionQuotaMonitor(
  intervalMs: number = DEFAULT_INTERVAL_MS
): () => void {
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
