const THUMBNAIL_SIZE = 64;
const THUMBNAIL_QUALITY = 0.6;
const THUMBNAIL_FORMAT = 'image/webp';

interface ThumbnailRequest {
  type: 'GENERATE';
  id: string;
  file: File;
}

interface ThumbnailResponse {
  type: 'THUMBNAIL' | 'ERROR';
  id: string;
  dataUrl?: string;
  error?: string;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

self.onmessage = async (e: MessageEvent<ThumbnailRequest>) => {
  const { type, id, file } = e.data;
  if (type !== 'GENERATE') {
    return;
  }

  try {
    if (!file) {
      throw new Error('No file provided');
    }

    const bitmap = await createImageBitmap(file, {
      resizeWidth: THUMBNAIL_SIZE,
      resizeHeight: THUMBNAIL_SIZE,
      resizeQuality: 'low',
    });

    const canvas = new OffscreenCanvas(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      bitmap.close();
      throw new Error('Could not get 2d context');
    }

    const scale = Math.min(
      THUMBNAIL_SIZE / bitmap.width,
      THUMBNAIL_SIZE / bitmap.height
    );
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    const x = (THUMBNAIL_SIZE - width) / 2;
    const y = (THUMBNAIL_SIZE - height) / 2;

    ctx.drawImage(bitmap, x, y, width, height);
    bitmap.close();

    const blob = await canvas.convertToBlob({
      type: THUMBNAIL_FORMAT,
      quality: THUMBNAIL_QUALITY,
    });

    const dataUrl = await blobToDataUrl(blob);

    const response: ThumbnailResponse = {
      type: 'THUMBNAIL',
      id,
      dataUrl,
    };
    self.postMessage(response);
  } catch (error) {
    const response: ThumbnailResponse = {
      type: 'ERROR',
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    self.postMessage(response);
  }
};