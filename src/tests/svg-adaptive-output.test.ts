/* eslint-disable @typescript-eslint/no-explicit-any */
import { TextEncoder as NodeTextEncoder } from 'node:util'
import { describe, expect, it, vi } from 'vitest'

import { processSvg } from '@/workers/svg-pipeline'

// Define ImageData mock globally for node environment
if (globalThis.ImageData === undefined) {
  ;(globalThis as any).ImageData = class ImageData {
    data: Uint8ClampedArray
    height: number
    width: number
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data
      this.width = width
      this.height = height
    }
  }
}

// Mock dependencies that involve heavy lifting or browser APIs
if (globalThis.File === undefined) {
  ;(globalThis as any).File = class File {
    bits: any[]
    name: string
    options: any
    constructor(bits: any[], name: string, options: any) {
      this.bits = bits
      this.name = name
      this.options = options
    }
    async text() {
      return this.bits.join('')
    }
  }
}

if (globalThis.Blob === undefined) {
  ;(globalThis as any).Blob = class Blob {
    bits: any[]
    options: any
    constructor(bits: any[], options: any) {
      this.bits = bits
      this.options = options
    }
    async text() {
      return this.bits.join('')
    }
  }
}

if (globalThis.createImageBitmap === undefined) {
  ;(globalThis as any).createImageBitmap = vi.fn(async () => ({
    close: () => {},
    height: 100,
    width: 100,
  }))
}

if ((globalThis as any).OffscreenCanvas === undefined) {
  ;(globalThis as any).OffscreenCanvas = class OffscreenCanvas {
    height: number
    width: number
    constructor(width: number, height: number) {
      this.width = width
      this.height = height
    }
    getContext() {
      return {
        drawImage: () => {},
        getImageData: (_x: number, _y: number, w: number, h: number) => {
          return new (globalThis as any).ImageData(new Uint8ClampedArray(w * h * 4), w, h)
        },
      }
    }
  }
}

if (globalThis.TextEncoder === undefined) {
  ;(globalThis as any).TextEncoder = NodeTextEncoder
}
vi.mock('@/lib/optimizer/svg-optimizer', () => ({
  optimizeSvg: vi.fn(async (text: string) => {
    let type: 'COMPLEX' | 'HYBRID' | 'SIMPLE' = 'SIMPLE'
    let nodeCount = 0
    let rasterBytes = 0

    if (text.includes('<image')) {
      type = 'HYBRID'
      rasterBytes = 32_769 // Trigger shouldWrap with 32KB+ rule
    } else if (text.split('<').length > 1500) {
      type = 'COMPLEX'
      nodeCount = 1501 // Trigger shouldWrap with vector complexity rule
    }

    const data = text.length < 4096 ? text.padEnd(4096, ' ') : text

    return {
      data,
      metadata: {
        hasFilters: false,
        nodeCount,
        rasterBytes,
        segmentCount: 0,
        type,
      },
    }
  }),
  svgByteLength: (text: string) => text.length,
}))

vi.mock('@/workers/optimizer-wasm', () => ({
  ensureResvg: vi.fn(),
}))

// We need to mock Resvg since it's a WASM module that might not run in this environment
vi.mock('@resvg/resvg-wasm', () => {
  return {
    Resvg: vi.fn().mockImplementation((_text, options) => {
      let width = 100
      let height = 100

      // If fitTo width is provided, use it to satisfy invariants in tests
      if (options?.fitTo?.mode === 'width') {
        width = options.fitTo.value
        height = options.fitTo.value // Assume square for simplicity in mocks
      }

      return {
        free: () => {},
        height,
        render: () => ({
          free: () => {},
          height,
          pixels: new Uint8Array(width * height * 4),
          width,
        }),
        width,
      }
    }),
  }
})

vi.mock('@/workers/svg-browser-raster', () => ({
  rasterizeSvgWithBrowser: vi.fn(),
}))

vi.mock('@/lib/codecs/raster/lossless', () => ({
  encodeLossless: vi.fn(async () => new Uint8Array([4, 5, 6])),
}))

vi.mock('@/workers/raster-encode', () => ({
  checkPixelLimit: vi.fn(),
  toBase64: vi.fn(async () => 'mock-base64'),
}))

vi.mock('@/workers/classify', () => ({
  classifyContent: vi.fn(() => 'artwork'),
}))

describe('SVG Adaptive Output Pipeline', () => {
  const defaultOptions = {
    svgDisplayDpr: 1,
    svgExportDensity: 'legacy' as const,
    svgInternalFormat: 'webp' as const,
    svgRasterizer: 'resvg' as const,
  }

  it('classifies SIMPLE SVG and returns optimized SVG (not wrapped)', async () => {
    const simpleSvg = '<svg><circle /></svg>'
    const buffer = new TextEncoder().encode(simpleSvg).buffer

    const result = await processSvg(buffer, defaultOptions)

    expect(result.label).toBe('svg (optimized)')
    const text = await result.blob.text()
    expect(text).toContain('<circle />')
    expect(text).not.toContain('<image')
  })

  it('classifies COMPLEX SVG and returns raster-wrapped webp', async () => {
    // 1501 nodes triggers COMPLEX
    const complexSvg = '<svg>' + '<rect />'.repeat(1501) + '</svg>'
    const buffer = new TextEncoder().encode(complexSvg).buffer

    const result = await processSvg(buffer, defaultOptions)

    // Label should indicate wrapped
    expect(result.label).toContain('svg (webp)')

    const text = await result.blob.text()
    // Should be wrapped in an SVG with an image tag
    expect(text).toContain('<image')
    // Should have used webp for internal encoding
    expect(text).toContain('data:image/webp;base64,mock-base64')
  })

  it('classifies HYBRID SVG and returns raster-wrapped webp', async () => {
    // <image> triggers HYBRID
    const hybridSvg = '<svg><image href="foo.png" /></svg>'
    const buffer = new TextEncoder().encode(hybridSvg).buffer

    const result = await processSvg(buffer, defaultOptions)

    expect(result.label).toContain('svg (webp)')

    const text = await result.blob.text()
    expect(text).toContain('<image')
    expect(text).toContain('data:image/webp;base64,mock-base64')
  })
})
