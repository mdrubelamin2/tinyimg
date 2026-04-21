/**
 * Recursively scans an object for Transferable instances (ArrayBuffers, MessagePorts, Streams, etc.)
 * so they can be natively transferred via Web Worker `postMessage` with zero-copy.
 */
export function findTransferable(obj: unknown): Transferable[] {
  const transferable: Transferable[] = [];
  const visited = new Set<unknown>();

  function recurse(value: unknown) {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);

    if (
      value instanceof ArrayBuffer ||
      value instanceof MessagePort ||
      (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) ||
      (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) ||
      (typeof WritableStream !== 'undefined' && value instanceof WritableStream) ||
      (typeof TransformStream !== 'undefined' && value instanceof TransformStream)
    ) {
      transferable.push(value as Transferable);
    } else if (ArrayBuffer.isView(value)) {
      if (!transferable.includes(value.buffer)) {
        transferable.push(value.buffer);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        recurse(item);
      }
    } else if (value.constructor === Object) {
      for (const key of Object.keys(value)) {
        recurse((value as Record<string, unknown>)[key]);
      }
    }
  }

  recurse(obj);
  return transferable;
}
