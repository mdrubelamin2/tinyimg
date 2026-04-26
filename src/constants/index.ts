import { nanoid } from 'nanoid';
import type { SvgInternalFormat } from './formats.ts';
import { ID_RANDOM_LENGTH } from './limits.ts';

export * from './errors.ts';
export * from './formats.ts';
export * from './limits.ts';
export * from './presets.ts';
export * from './storage.ts';
export * from './ui.ts';
export * from './config.ts';

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

/** Raster output encoding: lossy adaptive vs lossless (`encodeLossless`). SVG→SVG hybrid is unaffected. */
export type LosslessEncoding = 'none' | 'all' | 'custom_sizes_only';

export interface GlobalOptions {
  formats: string[];
  useOriginalFormats: boolean;
  includeOriginalInCustom: boolean;
  /** When false, {@link customSizePresets} define pixel sizes (per format). */
  useOriginalSizes: boolean;
  /** In custom sizes mode, add one output at native decoded dimensions per format. */
  includeNativeSizeInCustom: boolean;
  customSizePresets: OutputSizePreset[];
  qualityPercent: number;
  stripMetadata: boolean;
  svgInternalFormat: SvgInternalFormat;
  svgRasterizer: 'auto' | 'browser' | 'resvg';
  svgExportDensity: 'legacy' | 'display';
  svgDisplayDpr: number;
  losslessEncoding: LosslessEncoding;
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
    { id: 'default-800w', width: 768, height: 0, maintainAspect: true },
  ],
  qualityPercent: 100,
  stripMetadata: true,
  svgInternalFormat: 'webp',
  svgRasterizer: 'resvg',
  svgExportDensity: 'display',
  svgDisplayDpr: 2,
  losslessEncoding: 'none',
};
