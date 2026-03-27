/**
 * Shared types for queue processor and worker message contract.
 * Single source of truth for ImageItem, ImageResult, Task, and options.
 */

import type {
  GlobalOptions,
  ItemStatus,
  SvgInternalFormat,
} from '../constants';

export type { GlobalOptions };

export interface ImageResult {
  format: string;
  label?: string | undefined;
  blob?: Blob | undefined;
  size?: number | undefined;
  downloadUrl?: string | undefined;
  status: ItemStatus;
  error?: string | undefined;
}

export interface ImageItem {
  id: string;
  file: File;
  /** Object URL for thumbnail preview; revoke when item is removed or queue cleared */
  previewUrl?: string | undefined;
  status: ItemStatus;
  progress: number;
  originalSize: number;
  originalFormat: string;
  results: Record<string, ImageResult>;
  error?: string | undefined;
  /** Per-item format override (null = follow global config) */
  outputFormatsOverride?: string[] | null | undefined;
  /** Per-item quality override (null = follow global config) */
  qualityPercentOverride?: number | null | undefined;
}

export interface TaskOptions {
  format: string;
  svgInternalFormat: SvgInternalFormat;
  svgRasterizer: 'auto' | 'browser' | 'resvg';
  svgExportDensity: 'legacy' | 'display';
  svgDisplayDpr: number;
  qualityPercent: number;
  resizeMaxEdge: number;
  stripMetadata: boolean;
}

export interface Task {
  id: string;
  format: string;
  file: File;
  options: TaskOptions;
}

/** Payload sent to the optimizer worker. */
export interface WorkerRequest {
  id: string;
  file: File;
  options: TaskOptions;
}

/** Success payload from the worker. */
export interface WorkerResponseSuccess {
  id: string;
  format: string;
  blob: Blob;
  size: number;
  label: string;
  status: 'success';
  timing?: {
    decodeMs?: number | undefined;
    classifyMs?: number | undefined;
    encodeMs?: number | undefined;
    svgoMs?: number | undefined;
    naturalSizeMs?: number | undefined;
    renderMs?: number | undefined;
    downscaleMs?: number | undefined;
    totalMs?: number | undefined;
    /** Which engine produced the SVG raster (`browser` vs `resvg`). */
    svgRasterizerPath?: 'browser' | 'resvg' | undefined;
  } | undefined;
}

/** Error payload from the worker. */
export interface WorkerResponseError {
  id: string;
  format: string;
  status: 'error';
  error: string;
}

export type WorkerResponse = WorkerResponseSuccess | WorkerResponseError;
