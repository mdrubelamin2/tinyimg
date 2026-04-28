import { describe, expect, it, vi } from 'vitest'

import { resizeImage } from '../../workers/raster-encode'

describe('resizeImage (OffscreenCanvas path)', () => {
  it('resizes via OffscreenCanvas when navigator.gpu is unavailable', async () => {
    vi.stubGlobal('navigator', { gpu: undefined })
    vi.stubGlobal(
      'OffscreenCanvas',
      class OffscreenCanvas {
        height: number
        width: number
        constructor(width: number, height: number) {
          this.width = width
          this.height = height
        }
        getContext() {
          return {
            drawImage: () => {},
            getImageData: () => ({
              data: new Uint8ClampedArray(this.width * this.height * 4),
              height: this.height,
              width: this.width,
            }),
          }
        }
      },
    )

    const mockBitmap = {
      height: 100,
      width: 100,
    } as ImageBitmap

    const result = await resizeImage(mockBitmap, 50, 50)
    expect(result.width).toBe(50)
    expect(result.height).toBe(50)
  })
})
