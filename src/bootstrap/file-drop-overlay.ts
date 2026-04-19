/**
 * Module-local file drag depth for the global drop overlay (subscribed via useSyncExternalStore).
 */

let depth = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeFileDropOverlay(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getFileDropOverlayOpen(): boolean {
  return depth > 0;
}

export function syncFileDragDepth(next: number): void {
  const n = Math.max(0, next);
  if (n === depth) return;
  depth = n;
  notify();
}

export function bumpFileDragDepth(delta: number): void {
  syncFileDragDepth(depth + delta);
}

export function resetFileDragDepth(): void {
  syncFileDragDepth(0);
}
