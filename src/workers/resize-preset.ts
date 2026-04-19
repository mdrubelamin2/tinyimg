/**
 * Map persisted resize preset + source dimensions to target pixel size.
 */

import type { TaskResizePreset } from '@/lib/queue/types';

export function resolveResizeTarget(
  w0: number,
  h0: number,
  preset: TaskResizePreset
): { width: number; height: number } | null {
  if (preset.kind === 'native') return null;
  const { maintainAspect, width: pw, height: ph } = preset;
  if (maintainAspect) {
    if (pw > 0) {
      const tw = pw;
      const th = Math.max(1, Math.round((h0 * tw) / w0));
      return { width: tw, height: th };
    }
    if (ph > 0) {
      const th = ph;
      const tw = Math.max(1, Math.round((w0 * th) / h0));
      return { width: tw, height: th };
    }
    return null;
  }
  if (pw < 1 || ph < 1) return null;
  return { width: pw, height: ph };
}
