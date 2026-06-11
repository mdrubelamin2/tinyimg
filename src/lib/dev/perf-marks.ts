const DEBUG_KEY = 'tinyimg:perf-debug'

export function isPerfDebugEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(DEBUG_KEY) === '1'
  } catch {
    return false
  }
}

export function perfMark(name: string): void {
  if (!isPerfDebugEnabled()) return
  try {
    performance.mark(name)
  } catch {
    /* noop */
  }
}

export function perfMeasure(name: string, start: string, end: string): void {
  if (!isPerfDebugEnabled()) return
  try {
    performance.measure(name, start, end)
  } catch {
    /* noop */
  }
}
