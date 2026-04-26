import { describe, expect, it } from 'vitest';
import { PRESETS } from '@/lib/codecs/raster/presets';
import type { RasterEncodePreset } from '@/lib/codecs/raster/types';
import {
  BOOST_MAX,
  applyScaleBoostToPreset,
  computeDownscaleRatio,
  qualityBoostFromRatio,
} from '@/lib/codecs/raster/adaptive-quality';

describe('computeDownscaleRatio', () => {
  it('returns 1 for identical dimensions', () => {
    expect(computeDownscaleRatio(100, 100, 100, 100)).toBe(1);
  });

  it('uses max of axis ratios', () => {
    expect(computeDownscaleRatio(200, 100, 100, 100)).toBe(2);
    expect(computeDownscaleRatio(100, 200, 100, 100)).toBe(2);
    expect(computeDownscaleRatio(400, 300, 200, 200)).toBe(2);
  });

  it('returns 1 when output dimension invalid', () => {
    expect(computeDownscaleRatio(100, 100, 0, 100)).toBe(1);
  });
});

describe('qualityBoostFromRatio', () => {
  it('is zero at or below 1:1', () => {
    expect(qualityBoostFromRatio(1)).toBe(0);
    expect(qualityBoostFromRatio(1 + 1e-4)).toBe(0);
  });

  it('is zero below MIN downscale (e.g. large → 2000w ~1.86×)', () => {
    expect(qualityBoostFromRatio(1.86)).toBe(0);
    expect(qualityBoostFromRatio(1.99)).toBe(0);
  });

  it('increases sublinearly and caps from MIN threshold', () => {
    expect(qualityBoostFromRatio(2)).toBe(4);
    const b4 = qualityBoostFromRatio(4);
    const bHuge = qualityBoostFromRatio(1e6);
    expect(b4).toBeGreaterThanOrEqual(4);
    expect(bHuge).toBe(BOOST_MAX);
  });
});

describe('applyScaleBoostToPreset', () => {
  it('does not mutate the source preset object graph', () => {
    const beforeQ = PRESETS.photo.jpeg.quality;
    const out = applyScaleBoostToPreset(
      PRESETS.photo as unknown as RasterEncodePreset,
      'jpeg',
      5,
      'photo'
    );
    expect(out.jpeg.quality).toBe(beforeQ + 5);
    expect(PRESETS.photo.jpeg.quality).toBe(beforeQ);
  });

  it('returns unchanged clone when boost is 0', () => {
    const out = applyScaleBoostToPreset(
      PRESETS.photo as unknown as RasterEncodePreset,
      'webp',
      0,
      'photo'
    );
    expect(out.webp.quality).toBe(PRESETS.photo.webp.quality);
  });

  it('clamps JPEG quality', () => {
    const base: RasterEncodePreset = {
      ...PRESETS.photo,
      jpeg: { ...PRESETS.photo.jpeg, quality: 92 },
    } as RasterEncodePreset;
    const out = applyScaleBoostToPreset(base, 'jpeg', 20, 'photo');
    expect(out.jpeg.quality).toBe(95);
  });

  it('keeps PNG quantMin <= quantMax and caps quantMax', () => {
    const out = applyScaleBoostToPreset(
      PRESETS.photo as unknown as RasterEncodePreset,
      'png',
      12,
      'photo'
    );
    expect(out.png.quantMin).toBeLessThanOrEqual(out.png.quantMax);
    expect(out.png.quantMax).toBeLessThanOrEqual(98);
  });

  it('forces 4:4:4 JPEG when graphic and boost is high', () => {
    const base: RasterEncodePreset = {
      ...PRESETS.graphic,
      jpeg: { ...PRESETS.graphic.jpeg, chroma_subsample: 1 },
    } as RasterEncodePreset;
    const out = applyScaleBoostToPreset(base, 'jpeg', 8, 'graphic');
    expect(out.jpeg.chroma_subsample).toBe(0);
  });
});
