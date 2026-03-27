/**
 * Shared config and helpers for quality-gate scripts.
 * Single source for paths, parseJSONC, and default thresholds.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

export const TEST_IMAGES_DIR = path.join(ROOT, 'test-images');
export const EXPECTED_JSONC_PATH = path.join(TEST_IMAGES_DIR, 'expected.jsonc');
export const QUALITY_THRESHOLDS_PATH = path.join(TEST_IMAGES_DIR, 'quality-thresholds.jsonc');
export const SIZE_OVERRIDES_PATH = path.join(TEST_IMAGES_DIR, 'size-overrides.jsonc');

export const DEFAULT_SIZE_TOLERANCE = 1.1;
export const SSIM_THRESHOLD_DEFAULT = 0.98;
export const PSNR_THRESHOLD_DEFAULT = 30;

/**
 * Strip JSONC comments and parse.
 */
export function parseJSONC(text) {
  const clean = text
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return JSON.parse(clean);
}

export function loadJSONCIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return parseJSONC(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}
