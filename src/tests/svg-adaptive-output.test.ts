/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, vi } from 'vitest';
import { processSvg } from '@/workers/svg-pipeline';

// Define ImageData mock globally for node environment
if (typeof global.ImageData === 'undefined') {
  (global as any).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
}

// Mock dependencies that involve heavy lifting or browser APIs
if (typeof global.File === 'undefined') {
  (global as any).File = class File {
    bits: any[];
    name: string;
    options: any;
    constructor(bits: any[], name: string, options: any) {
      this.bits = bits;
      this.name = name;
      this.options = options;
    }
    async text() {
      return this.bits.join('');
    }
  };
}

if (typeof global.Blob === 'undefined') {
  (global as any).Blob = class Blob {
    bits: any[];
    options: any;
    constructor(bits: any[], options: any) {
      this.bits = bits;
      this.options = options;
    }
    async text() {
      return this.bits.join('');
    }
  };
}

if (typeof global.createImageBitmap === 'undefined') {
  (global as any).createImageBitmap = vi.fn(async () => ({
    width: 100,
    height: 100,
    close: () => {},
  }));
}

if (typeof (global as any).OffscreenCanvas === 'undefined') {
  (global as any).OffscreenCanvas = class OffscreenCanvas {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext() {
      return {
        drawImage: () => {},
        getImageData: (x: number, y: number, w: number, h: number) => {
          return new (global as any).ImageData(new Uint8ClampedArray(w * h * 4), w, h);
        },
      };
    }
  };
}

if (typeof global.TextEncoder === 'undefined') {
  const util = require('util');
  (global as any).TextEncoder = util.TextEncoder;
}
vi.mock('@/lib/optimizer/svg-optimizer', () => ({
  optimizeSvg: vi.fn(async (text: string) => ({
    data: text, // No-op optimization for tests
    engine: 'svgo',
  })),
  svgByteLength: (text: string) => text.length,
}));

vi.mock('@/workers/optimizer-wasm', () => ({
  ensureResvg: vi.fn(),
}));

// We need to mock Resvg since it's a WASM module that might not run in this environment
vi.mock('@resvg/resvg-wasm', () => {
  return {
    Resvg: vi.fn().mockImplementation((_text, options) => {
      let width = 100;
      let height = 100;
      
      // If fitTo width is provided, use it to satisfy invariants in tests
      if (options?.fitTo?.mode === 'width') {
        width = options.fitTo.value;
        height = options.fitTo.value; // Assume square for simplicity in mocks
      }

      return {
        width,
        height,
        render: () => ({
          width,
          height,
          pixels: new Uint8Array(width * height * 4),
          free: () => {},
        }),
        free: () => {},
      };
    }),
  };
});

vi.mock('@/workers/svg-browser-raster', () => ({
  rasterizeSvgWithBrowser: vi.fn(),
}));

vi.mock('@/workers/raster-encode', () => ({
  checkPixelLimit: vi.fn(),
  encodeRaster: vi.fn(async () => new Uint8Array([1, 2, 3])),
  encodeRasterVectorSafeWithSizeSafeguard: vi.fn(async () => new Uint8Array([4, 5, 6])),
  toBase64: vi.fn(async () => 'mock-base64'),
}));

vi.mock('@/workers/classify', () => ({
  classifyContent: vi.fn(() => 'artwork'),
}));

describe('SVG Adaptive Output Pipeline', () => {
  const defaultOptions = {
    svgInternalFormat: 'webp' as const,
    svgRasterizer: 'resvg' as const,
    svgExportDensity: 'legacy' as const,
    svgDisplayDpr: 1,
  };

  it('classifies SIMPLE SVG and returns optimized SVG (not wrapped)', async () => {
    const simpleSvg = '<svg><circle /></svg>';
    const file = new File([simpleSvg], 'simple.svg', { type: 'image/svg+xml' });
    
    const result = await processSvg(file, defaultOptions);
    
    expect(result.label).toBe('svg (optimized)');
    const text = await result.blob.text();
    expect(text).toContain('<circle />');
    expect(text).not.toContain('<image');
  });

  it('classifies COMPLEX SVG and returns raster-wrapped AVIF', async () => {
    // 1501 nodes triggers COMPLEX
    const complexSvg = '<svg>' + '<rect />'.repeat(1501) + '</svg>';
    const file = new File([complexSvg], 'complex.svg', { type: 'image/svg+xml' });
    
    const result = await processSvg(file, defaultOptions);
    
    // Label should indicate raster-wrapped
    expect(result.label).toContain('svg (raster-wrapped');
    
    const text = await result.blob.text();
    // Should be wrapped in an SVG with an image tag
    expect(text).toContain('<image');
    // Should have used AVIF for internal encoding
    expect(text).toContain('data:image/avif;base64,mock-base64');
  });

  it('classifies HYBRID SVG and returns raster-wrapped AVIF', async () => {
    // <image> triggers HYBRID
    const hybridSvg = '<svg><image href="foo.png" /></svg>';
    const file = new File([hybridSvg], 'hybrid.svg', { type: 'image/svg+xml' });
    
    const result = await processSvg(file, defaultOptions);
    
    expect(result.label).toContain('svg (raster-wrapped');
    
    const text = await result.blob.text();
    expect(text).toContain('<image');
    expect(text).toContain('data:image/avif;base64,mock-base64');
  });
});
