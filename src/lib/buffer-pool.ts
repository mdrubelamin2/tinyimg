/**
 * Buffer pool for reusing ArrayBuffers and reducing GC pressure.
 * Figma-inspired technique for handling large file operations.
 * Enhanced with memory pressure awareness.
 */

// Only import performance monitor in main thread (not in workers)
let performanceMonitor: any = null;
if (typeof document !== 'undefined') {
  performanceMonitor = await import('./performance-monitor').then(m => m.performanceMonitor);
}

class BufferPool {
  private pool: Map<number, ArrayBuffer[]> = new Map();
  private readonly maxPoolSize = 10;
  private readonly bucketSizes = [
    1024 * 256,      // 256KB
    1024 * 512,      // 512KB
    1024 * 1024,     // 1MB
    1024 * 1024 * 2, // 2MB
    1024 * 1024 * 5, // 5MB
    1024 * 1024 * 10, // 10MB
    1024 * 1024 * 25, // 25MB
  ];

  constructor() {
    // Clear pool on high memory pressure (only in main thread)
    if (performanceMonitor) {
      performanceMonitor.onMemoryPressure((pressure: number) => {
        if (pressure > 0.85) {
          console.warn('[BufferPool] High memory pressure, clearing pool');
          this.clear();
        }
      });
    }
  }

  /**
   * Acquire a buffer of at least the requested size.
   * Returns a pooled buffer if available, otherwise creates new.
   */
  acquire(size: number): ArrayBuffer {
    const bucketSize = this.getBucketSize(size);
    const bucket = this.pool.get(bucketSize) || [];

    const buffer = bucket.pop();
    if (buffer) {
      this.pool.set(bucketSize, bucket);
      return buffer;
    }

    return new ArrayBuffer(bucketSize);
  }

  /**
   * Release a buffer back to the pool for reuse.
   * Only pools buffers up to maxPoolSize per bucket.
   */
  release(buffer: ArrayBuffer): void {
    const size = buffer.byteLength;
    const bucketSize = this.getBucketSize(size);
    const bucket = this.pool.get(bucketSize) || [];

    if (bucket.length < this.maxPoolSize) {
      bucket.push(buffer);
      this.pool.set(bucketSize, bucket);
    }
  }

  /**
   * Clear all pooled buffers (useful for memory pressure).
   */
  clear(): void {
    this.pool.clear();
  }

  /**
   * Get statistics about pool usage.
   */
  getStats(): { bucketSize: number; count: number }[] {
    return Array.from(this.pool.entries()).map(([size, buffers]) => ({
      bucketSize: size,
      count: buffers.length,
    }));
  }

  private getBucketSize(size: number): number {
    // Find the smallest bucket that fits the requested size
    for (const bucketSize of this.bucketSizes) {
      if (size <= bucketSize) return bucketSize;
    }
    // If larger than all buckets, round up to nearest MB
    return Math.ceil(size / (1024 * 1024)) * 1024 * 1024;
  }
}

export const bufferPool = new BufferPool();
