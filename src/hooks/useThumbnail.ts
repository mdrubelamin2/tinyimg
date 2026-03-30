import { useState, useEffect } from 'react';
import { thumbnailCache } from '../lib/opfs/thumbnail-cache';
import { opfsManager } from '../lib/opfs/opfs-manager';

export function useThumbnail(
  id: string,
  fileHandle: FileSystemFileHandle | null | undefined,
  isVisible: boolean
): string | null {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible || !fileHandle) {
      return;
    }

    let cancelled = false;

    const loadThumbnail = async () => {
      try {
        const file = await opfsManager.readFile(fileHandle);
        const dataUrl = await thumbnailCache.get(id, file);
        
        if (!cancelled && dataUrl) {
          setThumbnailUrl(dataUrl);
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error);
      }
    };

    loadThumbnail();

    return () => {
      cancelled = true;
    };
  }, [id, fileHandle, isVisible]);

  return thumbnailUrl;
}