export class BitmapLifecycle {
  private bitmaps = new Map<string, ImageBitmap>();

  track(id: string, bitmap: ImageBitmap): void {
    if (this.bitmaps.has(id)) {
      this.close(id);
    }
    this.bitmaps.set(id, bitmap);
  }

  has(id: string): boolean {
    return this.bitmaps.has(id);
  }

  close(id: string): void {
    const bitmap = this.bitmaps.get(id);
    if (bitmap) {
      try {
        bitmap.close();
      } catch (error) {
        console.warn(`Failed to close bitmap ${id}:`, error);
      }
      this.bitmaps.delete(id);
    }
  }

  closeAll(): void {
    for (const [id] of this.bitmaps) {
      this.close(id);
    }
  }

  getMemoryUsage(): number {
    let total = 0;
    for (const bitmap of this.bitmaps.values()) {
      total += bitmap.width * bitmap.height * 4;
    }
    return total;
  }

  getCount(): number {
    return this.bitmaps.size;
  }
}

export const bitmapLifecycle = new BitmapLifecycle();