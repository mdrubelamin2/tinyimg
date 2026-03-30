/**
 * Barrel export: single import point for all constants.
 *
 * Usage:
 *   import { MAX_FILE_SIZE_BYTES, STATUS_PENDING, PRESETS } from '@/constants';
 */

export * from './limits.ts';
export * from './formats.ts';
export * from './errors.ts';
export * from './presets.ts';
export * from './ui.ts';

// --- Global options (depends on types from formats and limits) ---
import type { SvgInternalFormat } from './formats.ts';

export interface GlobalOptions {
  formats: string[];
  useOriginalFormats: boolean;
  includeOriginalInCustom: boolean;
  smallFilesFirst: boolean;
  stripMetadata: boolean;
  svgInternalFormat: SvgInternalFormat;
}

export const DEFAULT_GLOBAL_OPTIONS: GlobalOptions = {
  formats: [],
  useOriginalFormats: true,
  includeOriginalInCustom: false,
  smallFilesFirst: true,
  stripMetadata: true,
  svgInternalFormat: 'webp',
};

export const OPFS_ROOT_DIR = 'tinyimg-files';
export const OPFS_THUMBNAILS_DIR = 'thumbnails';
export const OPFS_ORIGINALS_DIR = 'originals';
export const OPFS_CLEANUP_DELAY_MS = 10000;

export const MAX_IN_MEMORY_ITEMS = 20;
export const THUMBNAIL_SIZE = 64;
export const THUMBNAIL_QUALITY = 0.6;
export const THUMBNAIL_FORMAT = 'image/webp';

export const PRIORITY_LANE_EXPRESS_MAX_SIZE = 1_000_000;
export const PRIORITY_LANE_NORMAL_MAX_SIZE = 10_000_000;
export const PRIORITY_LANE_EXPRESS_WORKERS = 2;
export const PRIORITY_LANE_NORMAL_WORKERS = 4;
export const PRIORITY_LANE_SLOW_WORKERS = 2;
export const PRIORITY_QUEUE_MAX_PENDING = 10;
