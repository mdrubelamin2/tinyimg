import { nanoid } from 'nanoid';
import type { SvgInternalFormat } from './formats.ts';
import { ID_RANDOM_LENGTH } from './limits.ts';

export * from './errors.ts';
export * from './formats.ts';
export * from './limits.ts';
export * from './presets.ts';
export * from './storage.ts';
export * from './ui.ts';

// --- Global options (depends on types from formats and limits) ---

/** One row in the custom output sizes list (config panel). */
export interface OutputSizePreset {
  id: string;
  width: number;
  height: number;
  maintainAspect: boolean;
}

export function newOutputSizePresetId(): string {
  return `sz_${nanoid(ID_RANDOM_LENGTH)}`;
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
