import { describe, expect, it } from 'vitest'

import { MAX_PIXELS, SVG_INTERNAL_SSAA_SCALE } from '@/constants'
import { computeEffectiveDisplayDpr, computeInternalRenderSize } from '@/workers/svg-pipeline'

const SVG_RASTERIZERS = ['auto', 'browser', 'resvg'] as const

describe('svg raster pipeline invariants', () => {
  it('exposes rasterizer options including auto and browser', () => {
    expect(SVG_RASTERIZERS).toEqual(['auto', 'browser', 'resvg'])
  })

  it('uses fixed internal SSAA scale when within pixel budget (legacy path)', () => {
    const { renderHeight, renderWidth } = computeInternalRenderSize(120, 80)
    expect(renderWidth).toBe(120 * SVG_INTERNAL_SSAA_SCALE)
    expect(renderHeight).toBe(80 * SVG_INTERNAL_SSAA_SCALE)
  })

  it('caps internal render size to MAX_PIXELS while keeping >= base size', () => {
    const width = 5000
    const height = 5000
    const { renderHeight, renderWidth } = computeInternalRenderSize(width, height)
    expect(renderWidth).toBeGreaterThanOrEqual(width)
    expect(renderHeight).toBeGreaterThanOrEqual(height)
    expect(renderWidth * renderHeight).toBeLessThanOrEqual(MAX_PIXELS)
  })

  it('computeEffectiveDisplayDpr clamps to 1–3', () => {
    expect(computeEffectiveDisplayDpr(100, 100, 0)).toBe(1)
    expect(computeEffectiveDisplayDpr(100, 100, 99)).toBe(3)
    expect(computeEffectiveDisplayDpr(100, 100, 2.4)).toBe(2)
  })

  it('computeEffectiveDisplayDpr lowers DPR when pixels would exceed MAX_PIXELS', () => {
    const w = 4000
    const h = 4000
    const dpr = computeEffectiveDisplayDpr(w, h, 3)
    expect(dpr).toBe(1)
    const pw = Math.round(w * dpr)
    const ph = Math.round(h * dpr)
    expect(pw * ph).toBeLessThanOrEqual(MAX_PIXELS)
  })

  it('computeEffectiveDisplayDpr uses sub-1 scale when 1:1 would exceed MAX_PIXELS', () => {
    const w = 12_000
    const h = 12_000
    const dpr = computeEffectiveDisplayDpr(w, h, 3)
    expect(dpr).toBeLessThan(1)
    const pw = Math.max(1, Math.round(w * dpr))
    const ph = Math.max(1, Math.round(h * dpr))
    expect(pw * ph).toBeLessThanOrEqual(MAX_PIXELS)
  })
})
