import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, vi } from 'vitest'

import { processSvg } from '@/workers/svg-pipeline'

// Mock File for Node environment
/*
class MockFile {
  name: string;
  private content: string;
  constructor(content: string, name: string) {
    this.content = content;
    this.name = name;
  }
  async text() { return this.content; }
}
*/

function findRepoRoot(startDir: string): string {
  let dir = startDir
  for (;;) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) {
      throw new Error('Could not find package.json above test file')
    }
    dir = parent
  }
}

const PROJECT_ROOT = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)))

globalThis.fetch = vi.fn().mockImplementation((url) => {
  const cleanUrl = url.toString().replace(/^file:\/\//, '')
  if (cleanUrl.startsWith('http')) {
    return Promise.reject(new Error('no network'))
  }

  let p = cleanUrl
  if (!path.isAbsolute(cleanUrl)) {
    p = cleanUrl.startsWith('/')
      ? path.join(PROJECT_ROOT, cleanUrl)
      : path.resolve(PROJECT_ROOT, cleanUrl)
  } else if (!fs.existsSync(p) && p.includes('node_modules')) {
    const parts = p.split('node_modules')
    const suffix = parts[1]
    if (suffix) {
      p = path.join(PROJECT_ROOT, 'node_modules', suffix)
    }
  }

  if (fs.existsSync(p)) {
    const buffer = fs.readFileSync(p)
    // Use a simple object that emscripten/wasm-loaders usually accept in Node
    const response = {
      arrayBuffer: () => Promise.resolve(buffer.buffer),
      blob: () =>
        Promise.resolve({
          arrayBuffer: () => Promise.resolve(buffer.buffer),
          text: () => Promise.resolve(buffer.toString()),
        }),
      json: () => Promise.resolve(JSON.parse(buffer.toString())),
      ok: true,
      status: 200,
      text: () => Promise.resolve(buffer.toString()),
    }
    return Promise.resolve(response)
  }
  return Promise.reject(new Error('File not found: ' + p))
})

// Mock WebAssembly.instantiateStreaming
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(WebAssembly as any).instantiateStreaming = async (response: any, importObject: any) => {
  const res = await response
  const buffer = await res.arrayBuffer()
  return WebAssembly.instantiate(buffer, importObject)
}

// Mock ImageData
globalThis.ImageData = class {
  data: Uint8ClampedArray
  height: number
  width: number
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data
    this.width = width
    this.height = height
  }
} as unknown as typeof ImageData

// Mock Blob for node
if (!globalThis.Blob) {
  const { Blob } = await import('node:buffer')
  // @ts-expect-error - Blob is not on global in this version of node
  globalThis.Blob = Blob
}

// Mock createImageBitmap and OffscreenCanvas
globalThis.createImageBitmap = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    close: () => {},
    height: 98,
    width: 98,
  })
})
;(globalThis as any).OffscreenCanvas = class {
  getContext() {
    return {
      clearRect: () => {},
      drawImage: () => {},
      getImageData: () => ({
        data: new Uint8ClampedArray(98 * 98 * 4),
        height: 98,
        width: 98,
      }),
    } as any
  }
} as any

describe('SVG Raster Debug', () => {
  it('analyzes svg-raster.svg processing', async () => {
    const filePath = path.join(PROJECT_ROOT, 'test-images/svg-raster.svg')
    const content = fs.readFileSync(filePath, 'utf8')
    // const file = new MockFile(content, 'svg-raster.svg') as unknown as File;

    try {
      const buffer = new TextEncoder().encode(content).buffer
      const result = await processSvg(buffer, {
        svgDisplayDpr: 1,
        svgInternalFormat: 'webp',
      })

      await result.blob.text()
    } catch {
      // ignore
    }
  })
})
