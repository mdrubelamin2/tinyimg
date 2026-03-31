/**
 * Performance monitoring with Web Vitals
 * Tracks INP, CLS, FCP, LCP, TTFB and long tasks
 * Enhanced with memory pressure detection and adaptive performance management
 */

import { onINP, onCLS, onFCP, onLCP, onTTFB } from 'web-vitals';

export interface PerformanceMetrics {
  inp: number | null;
  cls: number | null;
  fcp: number | null;
  lcp: number | null;
  ttfb: number | null;
  longTasks: number;
  memoryUsage: number | null;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: MemoryInfo;
}

interface DeviceMemoryNavigator extends Navigator {
  deviceMemory?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    inp: null,
    cls: null,
    fcp: null,
    lcp: null,
    ttfb: null,
    longTasks: 0,
    memoryUsage: null,
  };

  private longTaskObserver: PerformanceObserver | null = null;
  private memoryInterval: number | null = null;
  private memoryPressureCallbacks: Set<(pressure: number) => void> = new Set();
  private lastMemoryPressure = 0;

  init() {
    // Web Vitals monitoring
    onINP((metric) => {
      this.metrics.inp = metric.value;
      this.logMetric('INP', metric.value);
    });

    onCLS((metric) => {
      this.metrics.cls = metric.value;
      this.logMetric('CLS', metric.value);
    });

    onFCP((metric) => {
      this.metrics.fcp = metric.value;
      this.logMetric('FCP', metric.value);
    });

    onLCP((metric) => {
      this.metrics.lcp = metric.value;
      this.logMetric('LCP', metric.value);
    });

    onTTFB((metric) => {
      this.metrics.ttfb = metric.value;
      this.logMetric('TTFB', metric.value);
    });

    // Long Tasks monitoring
    if ('PerformanceObserver' in window) {
      try {
        this.longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              this.metrics.longTasks++;
              console.warn('[Performance] Long task detected:', {
                duration: `${entry.duration.toFixed(2)}ms`,
                startTime: `${entry.startTime.toFixed(2)}ms`,
              });
            }
          }
        });

        this.longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.warn('[Performance] Long task monitoring not supported');
      }
    }

    // Memory monitoring with pressure detection
    this.startMemoryMonitoring();
  }

  private startMemoryMonitoring() {
    if ('memory' in performance) {
      this.memoryInterval = window.setInterval(() => {
        const memory = (performance as any).memory;
        if (memory) {
          this.metrics.memoryUsage = memory.usedJSHeapSize;

          const pressure = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

          // Notify callbacks if pressure changed significantly
          if (Math.abs(pressure - this.lastMemoryPressure) > 0.05) {
            this.lastMemoryPressure = pressure;

            for (const callback of this.memoryPressureCallbacks) {
              callback(pressure);
            }
          }

          if (pressure > 0.9) {
            console.warn('[Performance] Critical memory pressure:', {
              used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
              limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
              pressure: `${(pressure * 100).toFixed(1)}%`,
            });
          } else if (pressure > 0.7) {
            console.warn('[Performance] High memory pressure:', {
              used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
              limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
              pressure: `${(pressure * 100).toFixed(1)}%`,
            });
          }
        }
      }, 2000);
    }
  }

  /**
   * Register a callback to be notified of memory pressure changes.
   * Pressure is a value between 0 (no pressure) and 1 (critical).
   */
  onMemoryPressure(callback: (pressure: number) => void): () => void {
    this.memoryPressureCallbacks.add(callback);
    return () => {
      this.memoryPressureCallbacks.delete(callback);
    };
  }

  /**
   * Get current memory pressure (0-1).
   */
  getMemoryPressure(): number {
    const perf = performance as PerformanceWithMemory;
    if (!perf.memory) return 0;
    const { usedJSHeapSize, jsHeapSizeLimit } = perf.memory;
    return usedJSHeapSize / jsHeapSizeLimit;
  }

  /**
   * Get device memory in GB (if available).
   */
  getDeviceMemory(): number | null {
    const nav = navigator as DeviceMemoryNavigator;
    return nav.deviceMemory ?? null;
  }

  /**
   * Check if device is low-end based on memory.
   */
  isLowEndDevice(): boolean {
    const perf = performance as PerformanceWithMemory;
    const nav = navigator as DeviceMemoryNavigator;

    // Check heap limit
    if (perf.memory && perf.memory.jsHeapSizeLimit < 1024 * 1024 * 1024) {
      return true; // < 1GB heap
    }

    // Check device memory
    if (nav.deviceMemory && nav.deviceMemory < 4) {
      return true; // < 4GB RAM
    }

    return false;
  }

  /**
   * Get memory stats for debugging.
   */
  getMemoryStats(): {
    usedMB: number;
    totalMB: number;
    limitMB: number;
    pressure: number;
    deviceMemoryGB: number | null;
    isLowEnd: boolean;
  } | null {
    const perf = performance as PerformanceWithMemory;
    if (!perf.memory) return null;

    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = perf.memory;

    return {
      usedMB: Math.round(usedJSHeapSize / (1024 * 1024)),
      totalMB: Math.round(totalJSHeapSize / (1024 * 1024)),
      limitMB: Math.round(jsHeapSizeLimit / (1024 * 1024)),
      pressure: usedJSHeapSize / jsHeapSizeLimit,
      deviceMemoryGB: this.getDeviceMemory(),
      isLowEnd: this.isLowEndDevice(),
    };
  }

  private logMetric(name: string, value: number) {
    const rating = this.getRating(name, value);
    const color = rating === 'good' ? '✅' : rating === 'needs improvement' ? '⚠️' : '❌';
    console.log(`[Performance] ${color} ${name}: ${value.toFixed(2)}ms (${rating})`);
  }

  private getRating(name: string, value: number): string {
    const thresholds: Record<string, { good: number; poor: number }> = {
      INP: { good: 200, poor: 500 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      TTFB: { good: 800, poor: 1800 },
    };

    const threshold = thresholds[name];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs improvement';
    return 'poor';
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  destroy() {
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }

    if (this.memoryInterval !== null) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }

    this.memoryPressureCallbacks.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Auto-init in production
if (import.meta.env.PROD) {
  performanceMonitor.init();
}
