import { useState, useEffect } from 'react';
import { thumbnailCache } from '../lib/opfs/thumbnail-cache';
import { opfsManager } from '../lib/opfs/opfs-manager';

export function useThumbnail(
  id: string,
  fileHandle: FileSystemFileHandle | null,
  isVisible: boolean
): string | null {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isVisible || !fileHandle || loading) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    const loadThumbnail = async () => {
      try {
        const file = await opfsManager.readFile(fileHandle);
        const dataUrl = await thumbnailCache.get(id, file);
        
        if (!cancelled) {
          setThumbnailUrl(dataUrl);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadThumbnail();

    return () => {
      cancelled = true;
    };
  }, [id, fileHandle, isVisible, loading]);

  return thumbnailUrl;
}