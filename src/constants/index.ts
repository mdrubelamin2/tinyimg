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
export * from './storage.ts';

// --- Global options (depends on types from formats and limits) ---
import type { SvgInternalFormat } from './formats.ts';

/** One row in the custom output sizes list (config panel). */
export interface OutputSizePreset {
  id: string;
  width: number;
  height: number;
  maintainAspect: boolean;
}

export function newOutputSizePresetId(): string {
  return `sz_${Math.random().toString(36).slice(2, 10)}`;
}

export interface GlobalOptions {
  formats: string[];
  useOriginalFormats: boolean;
  includeOriginalInCustom: boolean;
  /** When false, {@link customSizePresets} define pixel sizes (per format). */
  useOriginalSizes: boolean;
  /** In custom sizes mode, add one output at native decoded dimensions per format. */
  includeNativeSizeInCustom: boolean;
  customSizePresets: OutputSizePreset[];
  smallFilesFirst: boolean;
  stripMetadata: boolean;
  svgInternalFormat: SvgInternalFormat;
}

/** Warn in UI when formats × sizes exceeds this (per image). */
export const OUTPUT_SLOT_EXPLOSION_WARN_THRESHOLD = 36;

export const DEFAULT_GLOBAL_OPTIONS: GlobalOptions = {
  formats: [],
  useOriginalFormats: true,
  includeOriginalInCustom: false,
  useOriginalSizes: true,
  includeNativeSizeInCustom: false,
  customSizePresets: [
    { id: 'default-800w', width: 800, height: 0, maintainAspect: true },
  ],
  smallFilesFirst: true,
  stripMetadata: true,
  svgInternalFormat: 'webp',
};
