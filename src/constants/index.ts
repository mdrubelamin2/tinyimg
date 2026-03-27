/**
 * Barrel export: single import point for all constants.
 *
 * Usage:
 *   import { MAX_FILE_SIZE_BYTES, STATUS_PENDING, PRESETS } from '../constants';
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
