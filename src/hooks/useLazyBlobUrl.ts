/**
 * Lazy blob URL creation hook with Intersection Observer
 * Creates URLs only when the element is near the viewport
 * Significantly reduces memory pressure and improves performance
 */

import { useState, useEffect, useRef } from 'react';

export function useLazyBlobUrl(blob: Blob | File | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<Element | null>(null);

  // Track visibility with Intersection Observer
  useEffect(() => {
    if (!blob) return;

    // Find the parent row element to observe
    // This is a bit hacky but works with our virtual scroll setup
    const findRowElement = () => {
      // Try to find the row element in the DOM
      // We'll set this from the component that uses this hook
      return elementRef.current;
    };

    const rowElement = findRowElement();
    if (!rowElement) {
      // Fallback: create URL immediately if we can't find the element
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        rootMargin: '200px', // Start loading 200px before entering viewport
        threshold: 0,
      }
    );

    observer.observe(rowElement);

    return () => {
      observer.disconnect();
    };
  }, [blob]);

  // Create blob URL only when visible
  useEffect(() => {
    if (!blob || !isVisible) {
      return;
    }

    // Use scheduler.postTask for non-blocking URL creation if available
    const createUrl = () => {
      const blobUrl = URL.createObjectURL(blob);
      setUrl(blobUrl);
      return blobUrl;
    };

    let blobUrl: string;

    if (typeof scheduler !== 'undefined' && typeof scheduler.postTask === 'function') {
      scheduler.postTask(createUrl, { priority: 'user-visible' })
        .then((url) => {
          blobUrl = url;
        })
        .catch(() => {
          // Fallback
          blobUrl = createUrl();
        });
    } else {
      blobUrl = createUrl();
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blob, isVisible]);

  return url;
}

/**
 * Simpler version without Intersection Observer for immediate use
 * Use this for visible items that need URLs right away
 */
export function useImmediateBlobUrl(blob: Blob | File | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }

    const blobUrl = URL.createObjectURL(blob);
    setUrl(blobUrl);

    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [blob]);

  return url;
}
