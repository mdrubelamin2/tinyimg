import { useImageStore } from '@/store/image-store'
import { computeConcurrency } from '@/workers/worker-pool-v2'

const PRESSURE_SAMPLE_MS = 10_000

type PressureObserverCtor = new (
  callback: (records: PressureRecord[]) => void,
  opts?: { sampleInterval?: number },
) => PressureObserverInstance
interface PressureObserverInstance {
  disconnect: () => void
  observe: (source: string) => void
}
interface PressureRecord {
  state?: string
}

/**
 * Surfaces CPU pressure (Chrome 125+) to dynamically reduce the worker pool concurrency.
 */
export function subscribeCpuPressureToast(): () => void {
  const PO = (globalThis as unknown as { PressureObserver?: PressureObserverCtor }).PressureObserver
  if (!PO) {
    return () => {}
  }
  let last: null | string = null
  const observer = new PO(
    (records) => {
      const state = records[0]?.state
      if (!state || state === last) return
      last = state
      const imageStore = useImageStore.getState()
      const pool = imageStore._getPool()
      if ((state === 'serious' || state === 'critical') && pool.activeCount > 0) {
        pool.setConcurrencyLimit(Math.max(1, Math.floor(pool.concurrencyLimit / 2)))
      } else {
        pool.setConcurrencyLimit(Math.min(computeConcurrency(), pool.concurrencyLimit * 2))
      }
    },
    { sampleInterval: PRESSURE_SAMPLE_MS },
  )
  try {
    observer.observe('cpu')
  } catch {
    return () => {}
  }
  return () => {
    try {
      observer.disconnect()
    } catch {
      /* noop */
    }
  }
}
