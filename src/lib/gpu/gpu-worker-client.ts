import GpuWorkerUrl from '@/workers/gpu.worker.ts?worker&url';

export class GpuResizeClient {
  private worker: Worker | null = null;

  async resize(bitmap: ImageBitmap, width: number, height: number): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        this.worker = new Worker(new URL(GpuWorkerUrl, import.meta.url), { type: 'module' });
      }

      this.worker.onmessage = (e) => {
        if (e.data.type === 'result') {
          resolve(e.data.imageData);
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.error));
        }
      };

      this.worker.onerror = reject;
      this.worker.postMessage({ type: 'resize', payload: { bitmap, width, height } }, { transfer: [bitmap] });
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
  }
}
