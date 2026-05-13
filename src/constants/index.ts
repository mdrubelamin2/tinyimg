import { nanoid } from 'nanoid'

import type { SvgInternalFormat } from './formats.ts'

import { ID_RANDOM_LENGTH } from './limits.ts'

export * from './config.ts'
export * from './errors.ts'
export * from './formats.ts'
export * from './limits.ts'
export * from './presets.ts'
export * from './storage.ts'
export * from './ui.ts'

// --- Global options (depends on types from formats and limits) ---

export interface GlobalOptions {
  customSizePresets: OutputSizePreset[]
  formats: string[]
  /** In custom sizes mode, add one output at native decoded dimensions per format. */
  includeNativeSizeInCustom: boolean
  includeOriginalInCustom: boolean
  losslessEncoding: LosslessEncoding
  qualityPercent: number
  stripMetadata: boolean
  svgDisplayDpr: number
  svgExportDensity: 'display' | 'legacy'
  svgInternalFormat: SvgInternalFormat
  svgRasterizer: 'auto' | 'browser' | 'resvg'
  useOriginalFormats: boolean
  /** When false, {@link customSizePresets} define pixel sizes (per format). */
  useOriginalSizes: boolean
}

/** Raster output encoding: lossy adaptive vs lossless (`encodeLossless`). SVG→SVG hybrid is unaffected. */
export type LosslessEncoding = 'all' | 'custom_sizes_only' | 'none'

/** One row in the custom output sizes list (config panel). */
export interface OutputSizePreset {
  height: number
  id: string
  maintainAspect: boolean
  width: number
}

export function newOutputSizePresetId(): string {
  return `sz_${nanoid(ID_RANDOM_LENGTH)}`
}

/** Warn in UI when formats × sizes exceeds this (per image). */
export const OUTPUT_SLOT_EXPLOSION_WARN_THRESHOLD = 36

export const DEFAULT_GLOBAL_OPTIONS: GlobalOptions = {
  customSizePresets: [{ height: 0, id: 'default-800w', maintainAspect: true, width: 768 }],
  formats: [],
  includeNativeSizeInCustom: false,
  includeOriginalInCustom: false,
  losslessEncoding: 'none',
  qualityPercent: 100,
  stripMetadata: true,
  svgDisplayDpr: 2,
  svgExportDensity: 'display',
  svgInternalFormat: 'webp',
  svgRasterizer: 'resvg',
  useOriginalFormats: true,
  useOriginalSizes: true,
}
