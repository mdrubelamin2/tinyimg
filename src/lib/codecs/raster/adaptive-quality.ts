/**
 * Downscale-aware encoder quality boost (always-on, zero UI).
 *
 * ## What the literature actually supports
 *
 * - **No universal scalar “start boosting here”** for still images: human **just-noticeable**
 *   distortion (**JND**) depends on **content**, **local spatial frequency**, and viewing
 *   geometry; modern predictors are **learned** and patch/semantic-aware (e.g. SG-JND,
 *   https://arxiv.org/abs/2408.04273 ), not a single threshold on global downscale ratio `s`.
 * - **Quantization vs resolution** is coupled through the **contrast sensitivity function**
 *   (spatial frequency): “visually lossless” bitstreams often use **resolution-dependent**
 *   quantization (e.g. JPEG 2000 browsing / CSF-shaped steps; see discussion in
 *   https://www.mdpi.com/2078-2489/7/3/45 and https://pmc.ncbi.nlm.nih.gov/articles/PMC5523141/ ).
 *
 * So we do **not** claim `s_min` is “proven optimal” in a JND sense. We anchor policy in
 * **signal-processing scale** (dyadic / octave steps), which is the standard way multirate
 * systems partition bandwidth (wavelets, pyramids, Nyquist reasoning): **one spatial octave**
 * is a **factor of 2** on the limiting axis.
 *
 * ## Implemented policy (conservative engineering)
 *
 * - `s = max(srcW/outW, srcH/outH)`.
 * - **No boost** until `s >= 2 ** SPATIAL_OCTAVES_BEFORE_QUALITY_BOOST` (default **1 octave → 2×**).
 *   Modest shrinks (e.g. large master → ~2000px wide, `s` ~ 1.8) stay on baseline presets only.
 * - For `s` above that gate: `b = min(B_MAX, round(K * log2(s)))` (sublinear in `s`, capped).
 * - Also `b = 0` when `s <= 1 + ε` (no downscale).
 *
 * Tuning: `SPATIAL_OCTAVES_BEFORE_QUALITY_BOOST`, `BOOST_K`, `BOOST_MAX`, per-codec clamps — no UI.
 */

import type { ContentPreset } from '@/workers/classify';
import type { RasterEncodePreset } from './types.ts';
import { PNG_MILD_QUANT_MAX } from './presets.ts';

/** Treat ~1:1 as no downscale (avoid float noise). */
export const DOWNSCALE_EPS = 1e-3;

/** log2(s) multiplier before rounding and capping. */
export const BOOST_K = 4;

/** Hard cap on quality boost units (shared across codecs before per-codec clamps). */
export const BOOST_MAX = 12;

/**
 * Octaves of linear downscale on the **limiting axis** before any encoder boost.
 * `1` → factor `2` (one dyadic / octave step). Not a universal JND threshold; see file comment.
 */
export const SPATIAL_OCTAVES_BEFORE_QUALITY_BOOST = 1;

/** `2 ** SPATIAL_OCTAVES_BEFORE_QUALITY_BOOST` — minimum `s` before `qualityBoostFromRatio` > 0. */
export const MIN_DOWNSCALE_RATIO_FOR_BOOST = 2 ** SPATIAL_OCTAVES_BEFORE_QUALITY_BOOST;

export function computeDownscaleRatio(
  srcW: number,
  srcH: number,
  outW: number,
  outH: number
): number {
  if (outW <= 0 || outH <= 0 || srcW <= 0 || srcH <= 0) return 1;
  return Math.max(srcW / outW, srcH / outH);
}

export function qualityBoostFromRatio(s: number): number {
  if (!Number.isFinite(s) || s <= 1 + DOWNSCALE_EPS) return 0;
  if (s < MIN_DOWNSCALE_RATIO_FOR_BOOST) return 0;
  const raw = BOOST_K * Math.log2(s);
  return Math.min(BOOST_MAX, Math.max(0, Math.round(raw)));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Returns a deep clone of `preset` with format-specific fields raised by boost `b`.
 * `contentPreset` affects JPEG chroma heuristics only (v1: graphic preset already uses 4:4:4).
 */
export function applyScaleBoostToPreset(
  preset: RasterEncodePreset,
  format: 'avif' | 'webp' | 'jpeg' | 'png',
  b: number,
  contentPreset: ContentPreset
): RasterEncodePreset {
  const out = structuredClone(preset);
  if (b <= 0) return out;

  switch (format) {
    case 'jpeg': {
      out.jpeg.quality = clamp(out.jpeg.quality + b, 30, 95);
      if (out.jpeg.separate_chroma_quality && out.jpeg.chroma_quality != null) {
        out.jpeg.chroma_quality = clamp(out.jpeg.chroma_quality + b, 30, 95);
      }
      if (contentPreset === 'graphic' && b >= 8) {
        out.jpeg.chroma_subsample = 0;
      }
      break;
    }
    case 'webp': {
      out.webp.quality = clamp(out.webp.quality + b, 25, 100);
      break;
    }
    case 'avif': {
      out.avif.quality = clamp(out.avif.quality + b, 28, 98);
      break;
    }
    case 'png': {
      const d = Math.round(b / 2);
      let qmin = out.png.quantMin + d;
      let qmax = out.png.quantMax + d;
      qmax = Math.min(qmax, PNG_MILD_QUANT_MAX);
      qmin = Math.min(qmin, qmax);
      qmin = Math.max(0, qmin);
      out.png.quantMin = qmin;
      out.png.quantMax = qmax;
      if (b >= 6) {
        out.png.oxipngLevel = Math.min(6, out.png.oxipngLevel + 1);
      }
      break;
    }
  }

  return out;
}
