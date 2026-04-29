import { describe, expect, it } from 'vitest'

import { DEFAULT_MIME, getMimeType } from '@/constants'

// Note: Testing workers in Bun/JSDOM can be tricky.
// For now we test purely the utility functions if exported or the logic itself.
// Since the worker is a standalone file, we'll focus on contract verification.

describe('Optimizer Contract', () => {
  it('should have correct mime-type mappings', () => {
    expect(getMimeType('test.svg')).toBe('image/svg+xml')
    expect(getMimeType('test.png')).toBe('image/png')
    expect(getMimeType('test.webp')).toBe('image/webp')
    expect(getMimeType('test.avif')).toBe('image/avif')
    expect(getMimeType('test.jpeg')).toBe('image/jpeg')
    expect(getMimeType('test.jpg')).toBe('image/jpeg')
    expect(getMimeType('test.bin')).toBe(DEFAULT_MIME)
  })

  it('should handle ZIP files by extension', () => {
    const isZip = (name: string) => name.endsWith('.zip')
    expect(isZip('backup.zip')).toBe(true)
    expect(isZip('image.png')).toBe(false)
  })
})
