/**
 * In-memory handles for **directly dropped** (or picker-selected) original `File`s.
 * Keeps a stable reference without copying bytes into the session hybrid store (OPFS → IDB → memory).
 * ZIP / folder-expanded rows use {@link getSessionBinaryStorage} instead — see `queue-binary.ts`.
 */

const directDropOriginals = new Map<string, File>()

export function clearDirectDropOriginals(): void {
  directDropOriginals.clear()
}

export function peekDirectDropOriginal(itemId: string): File | undefined {
  return directDropOriginals.get(itemId)
}

export function registerDirectDropOriginal(itemId: string, file: File): void {
  directDropOriginals.set(itemId, file)
}

export function releaseDirectDropOriginal(itemId: string): void {
  directDropOriginals.delete(itemId)
}
