/**
 * Module-local file drag depth for the global drop overlay (subscribed via useSyncExternalStore).
 */

let depth = 0
const listeners = new Set<() => void>()

export function bumpFileDragDepth(delta: number): void {
  syncFileDragDepth(depth + delta)
}

export function getFileDropOverlayOpen(): boolean {
  return depth > 0
}

export function resetFileDragDepth(): void {
  syncFileDragDepth(0)
}

export function subscribeFileDropOverlay(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

export function syncFileDragDepth(next: number): void {
  const n = Math.max(0, next)
  if (n === depth) return
  depth = n
  notify()
}

function notify(): void {
  for (const l of listeners) l()
}
