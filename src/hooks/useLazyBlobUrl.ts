/**
 * Lazy blob URL creation hook.
 * Creates blob URLs using useMemo to avoid setState in effects.
 * Worker-side blob URL creation handles the heavy lifting.
 */

import { useMemo, useEffect } from 'react';

export function useLazyBlobUrl(blob: Blob | undefined) {
  // Create blob URL using useMemo (derived state, not setState in effect)
  const url = useMemo(() => {
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }, [blob]);

  // Cleanup on unmount or when blob changes
  useEffect(() => {
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

  return url;
}
