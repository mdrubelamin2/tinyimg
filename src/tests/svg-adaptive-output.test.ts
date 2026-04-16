/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { TextEncoder as NodeTextEncoder } from 'node:util';
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
        getImageData: (_x: number, _y: number, w: number, h: number) => {
          return new (global as any).ImageData(new Uint8ClampedArray(w * h * 4), w, h);
        },
      };
    }
  };
}

if (typeof global.TextEncoder === 'undefined') {
  (global as any).TextEncoder = NodeTextEncoder;
}
vi.mock('@/lib/optimizer/svg-optimizer', () => ({
  optimizeSvg: vi.fn(async (text: string) => {
    let type: 'SIMPLE' | 'COMPLEX' | 'HYBRID' = 'SIMPLE';
    let nodeCount = 0;
    let rasterBytes = 0;
    
    if (text.includes('<image')) {
      type = 'HYBRID';
      rasterBytes = 32769; // Trigger shouldWrap with 32KB+ rule
    } else if (text.split('<').length > 1500) {
      type = 'COMPLEX';
      nodeCount = 1501; // Trigger shouldWrap with vector complexity rule
    }
    
    const data = text.length < 4096 ? text.padEnd(4096, ' ') : text;

    return {
      data,
      metadata: {
        nodeCount,
        segmentCount: 0,
        rasterBytes,
        hasFilters: false,
        type,
      },
    };
  }),
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

  it('classifies COMPLEX SVG and returns raster-wrapped webp', async () => {
    // 1501 nodes triggers COMPLEX
    const complexSvg = '<svg>' + '<rect />'.repeat(1501) + '</svg>';
    const file = new File([complexSvg], 'complex.svg', { type: 'image/svg+xml' });
    
    const result = await processSvg(file, defaultOptions);
    
    // Label should indicate wrapped
    expect(result.label).toContain('svg (webp-wrapped)');
    
    const text = await result.blob.text();
    // Should be wrapped in an SVG with an image tag
    expect(text).toContain('<image');
    // Should have used webp for internal encoding
    expect(text).toContain('data:image/webp;base64,mock-base64');
  });

  it('classifies HYBRID SVG and returns raster-wrapped webp', async () => {
    // <image> triggers HYBRID
    const hybridSvg = '<svg><image href="foo.png" /></svg>';
    const file = new File([hybridSvg], 'hybrid.svg', { type: 'image/svg+xml' });
    
    const result = await processSvg(file, defaultOptions);
    
    expect(result.label).toContain('svg (webp-wrapped)');
    
    const text = await result.blob.text();
    expect(text).toContain('<image');
    expect(text).toContain('data:image/webp;base64,mock-base64');
  });
});
