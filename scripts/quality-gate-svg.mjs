#!/usr/bin/env node
/**
 * SVG perceptual quality gate: rasterize original SVG at 2x, compare with optimized
 * output (wrapped SVG embed or raster). Uses resvg at 2× logical for reference.
 * App "display" mode may ship ~2× embeds; this script resizes optimized pixels to ref size before SSIM.
 * Run after E2E exports to test-output. See docs/ACCEPTANCE-CRITERIA.md.
 *
 * Usage: node scripts/quality-gate-svg.mjs <originalsDir> <optimizedDir>
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import ssim from 'ssim.js';
import { ROOT, SSIM_THRESHOLD_DEFAULT } from './common.mjs';

const SSIM_THRESHOLD = Math.max(SSIM_THRESHOLD_DEFAULT, 0.995);
const SHARPNESS_RATIO_THRESHOLD = 1.08;

let Resvg;
let resvgReady = false;

async function initResvg() {
  if (resvgReady) return;
  const wasmPath = path.join(ROOT, 'node_modules/@resvg/resvg-wasm/index_bg.wasm');
  const buf = fs.readFileSync(wasmPath);
  const wasmBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const resvgPkg = await import('@resvg/resvg-wasm');
  await resvgPkg.initWasm(wasmBuffer);
  Resvg = resvgPkg.Resvg;
  resvgReady = true;
}

function rasterizeSvgAt2x(svgString) {
  const r = new Resvg(svgString);
  const w = r.width;
  const r2 = new Resvg(svgString, { fitTo: { mode: 'width', value: w * 2 } });
  const rendered = r2.render();
  const pngBuf = rendered.asPng();
  const out = { buffer: Buffer.from(pngBuf), width: rendered.width, height: rendered.height };
  return out;
}

async function loadPixelsFromBuffer(buf) {
  const img = sharp(buf);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  };
}

function extractEmbedFromWrappedSvg(svgContent) {
  const m = svgContent.match(/href="data:image\/(\w+);base64,([^"]+)"/);
  if (!m) return null;
  const [, type, b64] = m;
  return { type: type.toLowerCase(), buffer: Buffer.from(b64, 'base64') };
}

function edgeEnergy(pixels) {
  const { data, width, height } = pixels;
  if (width < 3 || height < 3) return 0;
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      gray[y * width + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  }
  let sum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx =
        -gray[idx - width - 1] - 2 * gray[idx - 1] - gray[idx + width - 1] +
        gray[idx - width + 1] + 2 * gray[idx + 1] + gray[idx + width + 1];
      const gy =
        -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] +
        gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
      sum += Math.sqrt(gx * gx + gy * gy);
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

async function loadOptimizedPixels(filePath, refWidth, refHeight) {
  const raw = fs.readFileSync(filePath);
  const isSvg =
    raw[0] === 0x3c ||
    (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf && raw[3] === 0x3c);
  let buf = raw;
  if (isSvg) {
    const svgContent = raw.toString('utf-8');
    const embed = extractEmbedFromWrappedSvg(svgContent);
    if (embed) {
      buf = embed.buffer;
    } else {
      const { buffer } = rasterizeSvgAt2x(svgContent);
      buf = buffer;
    }
  }
  let pixels = await loadPixelsFromBuffer(buf);
  if (pixels.width !== refWidth || pixels.height !== refHeight) {
    const resized = await sharp(Buffer.from(pixels.data), {
      raw: { width: pixels.width, height: pixels.height, channels: 4 },
    })
      .resize(refWidth, refHeight)
      .raw()
      .toBuffer({ resolveWithObject: true });
    pixels = {
      data: new Uint8ClampedArray(resized.data),
      width: refWidth,
      height: refHeight,
    };
  }
  return pixels;
}

async function main() {
  const originalsDir = process.argv[2] || path.join(ROOT, 'test-images');
  const optimizedDir = process.argv[3];

  if (!optimizedDir || !fs.existsSync(originalsDir)) {
    console.error('Usage: node scripts/quality-gate-svg.mjs <originalsDir> <optimizedDir>');
    process.exit(1);
  }
  if (!fs.existsSync(optimizedDir)) {
    fs.mkdirSync(optimizedDir, { recursive: true });
  }

  await initResvg();

  const svgFiles = listSvgFilesRecursive(originalsDir);
  if (svgFiles.length === 0) {
    console.log('No SVG originals found. Skipping SVG gate.');
    process.exit(0);
  }

  const optFiles = fs.readdirSync(optimizedDir);
  const byBase = new Map();
  for (const f of optFiles) {
    const base = path.basename(f, path.extname(f));
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(f);
  }

  let failures = 0;
  for (const origPath of svgFiles) {
    const base = path.basename(origPath, path.extname(origPath));
    const opts = byBase.get(base) || [];
    const svgString = fs.readFileSync(origPath, 'utf-8');
    const { buffer: refBuf, width: refW, height: refH } = rasterizeSvgAt2x(svgString);
    const refPixels = await loadPixelsFromBuffer(refBuf);
    const refEdgeEnergy = edgeEnergy(refPixels);

    for (const optFile of opts) {
      const optPath = path.join(optimizedDir, optFile);
      const optPixels = await loadOptimizedPixels(optPath, refW, refH);
      if (!optPixels) {
        console.log(`  SKIP ${path.basename(origPath)} vs ${optFile} (no embed or unsupported)`);
        continue;
      }
      const ssimVal = ssim(refPixels, optPixels).mssim;
      const optEdgeEnergy = edgeEnergy(optPixels);
      const sharpnessRatio = refEdgeEnergy > 0 ? optEdgeEnergy / refEdgeEnergy : 1;
      const pass = ssimVal >= SSIM_THRESHOLD && sharpnessRatio >= SHARPNESS_RATIO_THRESHOLD;
      console.log(
        `  ${pass ? 'PASS' : 'FAIL'} ${path.basename(origPath)} vs ${optFile} SSIM=${ssimVal.toFixed(4)} sharpnessRatio=${sharpnessRatio.toFixed(3)}`
      );
      if (!pass) failures++;
    }
  }

  if (failures > 0) {
    console.error('\nSVG perceptual gate failed. See docs/ACCEPTANCE-CRITERIA.md.');
    process.exit(1);
  }
  console.log('SVG perceptual gate passed.');
}

function listSvgFilesRecursive(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSvgFilesRecursive(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
      out.push(fullPath);
    }
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
