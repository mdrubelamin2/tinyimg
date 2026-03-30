import { opfsManager } from './opfs-manager';

interface ThumbnailResponse {
  type: 'THUMBNAIL' | 'ERROR';
  id: string;
  dataUrl?: string;
  error?: string;
}

export class ThumbnailCache {
  private cache = new Map<string, string>();
  private pending = new Map<string, Promise<string | null>>();
  private worker: Worker | null = null;

  private getWorker(): Worker {
    if (!this.worker) {
      const workerUrl = new URL('/src/workers/thumbnail.worker.ts', window.location.origin);
      this.worker = new Worker(workerUrl, { type: 'module' });
    }
    return this.worker;
  }

  async get(id: string, file: File): Promise<string | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }
    if (this.pending.has(id)) {
      return this.pending.get(id)!;
    }

    const promise = this.generate(id, file);
    this.pending.set(id, promise);
    try {
      const dataUrl = await promise;
      this.pending.delete(id);
      return dataUrl;
    } catch (error) {
      this.pending.delete(id);
      throw error;
    }
  }

  private async generate(id: string, file: File): Promise<string | null> {
    const cached = await opfsManager.readThumbnail(id);
    if (cached) {
      const dataUrl = await this.fileToDataUrl(cached);
      this.cache.set(id, dataUrl);
      return dataUrl;
    }

    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      
      const handler = (e: MessageEvent<ThumbnailResponse>) => {
        if (e.data.id !== id) return;
        worker.removeEventListener('message', handler);
        if (e.data.type === 'ERROR') {
          reject(new Error(e.data.error || 'Thumbnail generation failed'));
          return;
        }
        if (e.data.dataUrl) {
          this.cache.set(id, e.data.dataUrl);
          this.saveThumbnailToOPFS(id, e.data.dataUrl).catch(console.error);
          resolve(e.data.dataUrl);
        } else {
          resolve(null);
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'GENERATE', id, file });
    });
  }

  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private async saveThumbnailToOPFS(id: string, dataUrl: string): Promise<void> {
    try {
      const base64 = dataUrl.split(',')[1];
      if (!base64) return;
      
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: 'image/webp' });
      await opfsManager.writeThumbnail(id, blob);
    } catch (error) {
      console.warn('Failed to save thumbnail to OPFS:', error);
    }
  }

  delete(id: string): void {
    this.cache.delete(id);
    this.pending.delete(id);
    opfsManager.deleteThumbnail(id).catch(console.error);
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }

  destroy(): void {
    this.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const thumbnailCache = new ThumbnailCache();