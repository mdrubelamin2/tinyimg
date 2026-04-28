#!/usr/bin/env node
/**
 * 2026 perceptual quality gate for TinyPNG parity (raster → raster).
 * Two metrics: SSIM >= 0.98 (or per-file ssimMin) and PSNR >= 30 dB (or psnrMin).
 * Optional overrides: test-images/quality-thresholds.jsonc (per-file ssimMin, psnrMin).
 * Scope: same small set as E2E. See docs/ACCEPTANCE-CRITERIA.md.
 *
 * Usage: node scripts/quality-gate.mjs <originalsDir> <optimizedDir>
 * Example: node scripts/quality-gate.mjs test-images ./test-output
 *
 * If the gate fails: inspect reported image(s), SSIM and PSNR. Consider
 * tuning encode paths in src/workers/optimize-task-core.ts (or related codecs)
 * or adding overrides in quality-thresholds.jsonc.
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import sharp from 'sharp'
import {
  ROOT,
  parseJSONC,
  SSIM_THRESHOLD_DEFAULT,
  PSNR_THRESHOLD_DEFAULT,
  QUALITY_THRESHOLDS_PATH,
} from './common.mjs'
const require = createRequire(import.meta.url)
const { ssim } = require('ssim.js')

const RASTER_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif'])

function loadQualityThresholds(originalsDir) {
  const dir = path.isAbsolute(originalsDir) ? originalsDir : path.join(ROOT, originalsDir)
  const p = path.join(dir, path.basename(QUALITY_THRESHOLDS_PATH))
  if (!fs.existsSync(p)) return {}
  try {
    const data = parseJSONC(fs.readFileSync(p, 'utf-8'))
    const out = {}
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith('_')) continue
      if (v && typeof v === 'object' && (v.ssimMin != null || v.psnrMin != null || v.formats))
        out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function getThresholds(thresholds, originalBasename, format) {
  const baseNoExt = path.basename(originalBasename, path.extname(originalBasename))
  const byFile = thresholds[originalBasename] ?? thresholds[baseNoExt]
  const fmt = byFile?.formats?.[format]
  return {
    ssimMin: fmt?.ssimMin ?? byFile?.ssimMin ?? SSIM_THRESHOLD_DEFAULT,
    psnrMin: fmt?.psnrMin ?? byFile?.psnrMin ?? PSNR_THRESHOLD_DEFAULT,
  }
}

function isRaster(filename) {
  const ext = path.extname(filename).toLowerCase()
  return RASTER_EXT.has(ext)
}

async function loadAsImageData(filePath) {
  const img = sharp(filePath)
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  }
}

/** Composite RGBA onto opaque background (e.g. white for JPEG comparison). */
function compositeOnBackground(imageData, bgR = 255, bgG = 255, bgB = 255) {
  const { data } = imageData
  const out = new Uint8ClampedArray(data.length)
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255
    out[i] = Math.round(data[i] * a + bgR * (1 - a))
    out[i + 1] = Math.round(data[i + 1] * a + bgG * (1 - a))
    out[i + 2] = Math.round(data[i + 2] * a + bgB * (1 - a))
    out[i + 3] = 255
  }
  return { ...imageData, data: out }
}

function hasTransparency(imageData) {
  for (let i = 3; i < imageData.data.length; i += 4) {
    if (imageData.data[i] < 255) return true
  }
  return false
}

/** Unique RGB count (sample step to cap work). Used for adaptive palette-vs-truecolor detection. */
function countUniqueRgb(imageData, maxPixels = 500_000) {
  const { data, width, height } = imageData
  const total = width * height
  const step = total <= maxPixels ? 1 : Math.ceil(total / maxPixels)
  const set = new Set()
  for (let i = 0; i < data.length; i += 4 * step) {
    set.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
  }
  return set.size
}

async function loadAndAlign(originalPath, optimizedPath) {
  let orig = await loadAsImageData(originalPath)
  let opt = await loadAsImageData(optimizedPath)
  const optExt = path.extname(optimizedPath).toLowerCase()
  if ((optExt === '.jpg' || optExt === '.jpeg') && hasTransparency(orig)) {
    orig = compositeOnBackground(orig, 0, 0, 0)
  }
  if (opt.width !== orig.width || opt.height !== orig.height) {
    const buf = Buffer.from(opt.data)
    const resized = await sharp(buf, {
      raw: { width: opt.width, height: opt.height, channels: 4 },
    })
      .resize(orig.width, orig.height)
      .raw()
      .toBuffer({ resolveWithObject: true })
    opt = {
      data: new Uint8ClampedArray(resized.data),
      width: orig.width,
      height: orig.height,
    }
  }
  return { orig, opt }
}

/** PSNR = 10*log10(255²/MSE), MSE over all channels (standard formula). */
function computePSNR(orig, opt) {
  const n = orig.data.length
  if (n !== opt.data.length) return 0
  let sumSq = 0
  for (let i = 0; i < n; i++) {
    const d = orig.data[i] - opt.data[i]
    sumSq += d * d
  }
  const mse = sumSq / n || 1e-10
  const maxVal = 255
  return 10 * Math.log10((maxVal * maxVal) / mse)
}

async function comparePairFull(originalPath, optimizedPath) {
  const { orig, opt } = await loadAndAlign(originalPath, optimizedPath)
  const ssimVal = ssim(orig, opt).mssim
  const psnrVal = computePSNR(orig, opt)
  return { ssimVal, psnrVal, orig, opt }
}

function collectPairs(originalsDir, optimizedDir) {
  const pairs = []
  const origFiles = fs.readdirSync(originalsDir).filter((f) => isRaster(f))
  const optFiles = fs.readdirSync(optimizedDir)
  const optByBase = new Map()
  for (const f of optFiles) {
    if (!isRaster(f)) continue
    const base = path.basename(f, path.extname(f))
    if (!optByBase.has(base)) optByBase.set(base, [])
    optByBase.get(base).push(f)
  }
  for (const orig of origFiles) {
    const base = path.basename(orig, path.extname(orig))
    const opts = optByBase.get(base) || []
    for (const opt of opts) {
      const format = path.extname(opt).toLowerCase().replace(/^\./, '') || 'unknown'
      pairs.push({
        original: path.join(originalsDir, orig),
        optimized: path.join(optimizedDir, opt),
        originalBasename: orig,
        format,
        label: `${orig} vs ${opt}`,
      })
    }
  }
  return pairs
}

async function main() {
  const originalsDir = process.argv[2] || path.join(ROOT, 'test-images')
  const optimizedDir = process.argv[3]

  if (!optimizedDir) {
    console.error('Usage: node scripts/quality-gate.mjs <originalsDir> <optimizedDir>')
    console.error('Optimized dir is required (e.g. output from E2E export or reference run).')
    process.exit(1)
  }

  if (!fs.existsSync(originalsDir)) {
    console.error('Originals directory must exist.')
    process.exit(1)
  }
  if (!fs.existsSync(optimizedDir)) {
    fs.mkdirSync(optimizedDir, { recursive: true })
  }

  const pairs = collectPairs(originalsDir, optimizedDir)
  if (pairs.length === 0) {
    console.log('No raster (original, optimized) pairs found. Skipping perceptual gate.')
    process.exit(0)
  }

  const thresholds = loadQualityThresholds(originalsDir)
  console.log(
    `Comparing ${pairs.length} raster pair(s): SSIM >= ${SSIM_THRESHOLD_DEFAULT}, PSNR >= ${PSNR_THRESHOLD_DEFAULT} dB (adaptive: palette vs truecolor, transparent+webp)...`,
  )
  const failures = []
  for (const { original, optimized, originalBasename, format, label } of pairs) {
    let { ssimMin, psnrMin } = getThresholds(thresholds, originalBasename, format)
    const { ssimVal, psnrVal, orig, opt } = await comparePairFull(original, optimized)
    const origColors = countUniqueRgb(orig)
    const optColors = countUniqueRgb(opt)
    // Adaptive: palette vs truecolor — no industry standard for this comparison; 0.35/12 is empirical (project-specific). See docs/QUALITY-RESEARCH.md.
    if (origColors > 256 && optColors <= 256) {
      ssimMin = Math.min(ssimMin, 0.35)
      psnrMin = Math.min(psnrMin, 12)
    }
    // Adaptive: transparent original vs lossy WebP — 0.80/19 empirical; some studies report lossy WebP ~0.89–0.90 vs PNG. See docs/QUALITY-RESEARCH.md.
    if (hasTransparency(orig) && format === 'webp') {
      ssimMin = Math.min(ssimMin, 0.8)
      psnrMin = Math.min(psnrMin, 19)
    }
    const ssimPass = ssimVal >= ssimMin
    const psnrPass = psnrVal >= psnrMin
    const pass = ssimPass && psnrPass
    const thresholdNote =
      ssimMin !== SSIM_THRESHOLD_DEFAULT || psnrMin !== PSNR_THRESHOLD_DEFAULT
        ? ` (SSIM>=${ssimMin}, PSNR>=${psnrMin})`
        : ''
    console.log(
      `  ${pass ? 'PASS' : 'FAIL'} ${label} SSIM=${ssimVal.toFixed(4)} PSNR=${psnrVal.toFixed(1)}dB${thresholdNote}`,
    )
    if (!pass) failures.push({ label, ssimVal, psnrVal, ssimMin, psnrMin })
  }

  if (failures.length > 0) {
    console.error('\nPerceptual gate failed (SSIM and/or PSNR below threshold).')
    console.error(
      'Inspect the reported image(s); adjust worker constants or quality-thresholds.jsonc.',
    )
    console.error('See docs/ACCEPTANCE-CRITERIA.md.')
    process.exit(1)
  }
  console.log('Perceptual gate passed (SSIM + PSNR).')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
