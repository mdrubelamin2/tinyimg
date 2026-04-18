/** OPFS-safe opaque names: `tinyimg:` + lowercase hex(UTF-8 key). */
export const PREFIX = 'tinyimg';

/** Maps logical storage key to a single-segment filename safe for OPFS across browsers. */
export function toFileName(key: string): string {
  const enc = new TextEncoder();
  return PREFIX + [...enc.encode(key)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Inverse of {@link toFileName}; returns null if not our hex-encoded name. */
export function fileNameToKey(name: string): string | null {
  const dec = new TextDecoder();
  if (!name.startsWith(PREFIX)) return null;
  const hex = name.slice(PREFIX.length);
  if (hex.length % 2) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const v = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(v)) return null;
    bytes[i] = v;
  }
  try {
    return dec.decode(bytes);
  } catch {
    return null;
  }
}
