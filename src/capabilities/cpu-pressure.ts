import { toastWarning } from '@/notifications/toast-emitter';

const PRESSURE_SAMPLE_MS = 1_500;

type PressureRecord = { state?: string };
type PressureObserverInstance = { observe: (source: string) => void; disconnect: () => void };
type PressureObserverCtor = new (
  callback: (records: PressureRecord[]) => void,
  opts?: { sampleInterval?: number }
) => PressureObserverInstance;

/**
 * Surfaces CPU pressure (Chrome 125+) as a user-visible hint; does not pause the queue.
 */
export function subscribeCpuPressureToast(): () => void {
  const PO = (globalThis as unknown as { PressureObserver?: PressureObserverCtor }).PressureObserver;
  if (!PO) {
    return () => {};
  }
  let last: string | null = null;
  const observer = new PO(
    (records) => {
      const state = records[0]?.state;
      if (!state || state === last) return;
      last = state;
      if (state === 'serious' || state === 'critical') {
        toastWarning('Device is under heavy CPU load. Optimization may slow down until the system recovers.');
      }
    },
    { sampleInterval: PRESSURE_SAMPLE_MS }
  );
  try {
    observer.observe('cpu');
  } catch {
    return () => {};
  }
  return () => {
    try {
      observer.disconnect();
    } catch {
      /* noop */
    }
  };
}
