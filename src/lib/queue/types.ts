/**
 * Shared types for the queue system, worker protocol, and task management.
 * This is the single source of truth for data shapes across main thread and workers.
 */

import type {
  ItemStatus,
  SvgInternalFormat,
  GlobalOptions,
} from '@/constants/index.ts';

export type { GlobalOptions };

// ---------------------------------------------------------------------------
// Pipeline stages (for granular progress reporting)
// ---------------------------------------------------------------------------
export type PipelineStage =
  | 'decode'
  | 'classify'
  | 'resize'
  | 'encode'
  | 'svg-optimize'
  | 'svg-rasterize';

// ---------------------------------------------------------------------------
// Stage timing (shared between raster and SVG paths)
// ---------------------------------------------------------------------------
export interface StageTiming {
  decodeMs?: number | undefined;
  classifyMs?: number | undefined;
  encodeMs?: number | undefined;
  resizeMs?: number | undefined;
  svgoMs?: number | undefined;
  naturalSizeMs?: number | undefined;
  renderMs?: number | undefined;
  downscaleMs?: number | undefined;
  totalMs?: number | undefined;
  svgRasterizerPath?: 'browser' | 'resvg' | undefined;
  svgEffectiveDpr?: number | undefined;
}

// ---------------------------------------------------------------------------
// Image result (one per output format per item)
// ---------------------------------------------------------------------------
export interface ImageResult {
  format: string;
  label?: string | undefined;
  blob?: Blob | undefined;
  size?: number | undefined;
  formattedSize?: string | undefined;
  savingsPercent?: number | undefined;
  downloadUrl?: string | undefined;
  status: ItemStatus;
  error?: string | undefined;
  timing?: StageTiming | undefined;
}

// ---------------------------------------------------------------------------
// Queue item (one per uploaded file)
// ---------------------------------------------------------------------------
export interface ImageItem {
  id: string;
  file: File;
  previewUrl?: string | undefined;
  status: ItemStatus;
  progress: number;
  originalSize: number;
  formattedOriginalSize?: string | undefined;
  originalFormat: string;
  results: Record<string, ImageResult>;
  error?: string | undefined;
  /** Per-item format override (null = follow global config) */
  outputFormatsOverride?: string[] | null | undefined;
  /** Per-item quality override (null = follow global config) */
  qualityPercentOverride?: number | null | undefined;
}

// ---------------------------------------------------------------------------
// Task options (sent to the worker for each encode job)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Task (queued unit of work for the worker pool)
// ---------------------------------------------------------------------------
export interface Task {
  id: string;
  format: string;
  file: File;
  options: TaskOptions;
}

// ---------------------------------------------------------------------------
// Worker protocol — Discriminated unions for typed messaging
// ---------------------------------------------------------------------------

/** Main thread → Worker messages */
export type WorkerInbound =
  | { type: 'OPTIMIZE'; taskId: string; file: File; options: TaskOptions }
  | { type: 'CANCEL'; taskId: string }
  | { type: 'PRELOAD_CODEC'; format: string };

/** Worker → Main thread messages */
export type WorkerOutbound =
  | WorkerOutboundProgress
  | WorkerOutboundResult
  | WorkerOutboundError
  | WorkerOutboundCancelled;

export interface WorkerOutboundProgress {
  type: 'PROGRESS';
  taskId: string;
  stage: PipelineStage;
  percent: number;
}

export interface WorkerOutboundResult {
  type: 'RESULT';
  taskId: string;
  format: string;
  blob: Blob;
  size: number;
  label: string;
  formattedSize: string;
  savingsPercent: number;
  timing?: StageTiming | undefined;
}

export interface WorkerOutboundError {
  type: 'ERROR';
  taskId: string;
  format: string;
  error: string;
}

export interface WorkerOutboundCancelled {
  type: 'CANCELLED';
  taskId: string;
}

// ---------------------------------------------------------------------------
// Legacy compat: WorkerResponse union (bridges old queue-results.ts)
// ---------------------------------------------------------------------------
export interface WorkerResponseSuccess {
  id: string;
  format: string;
  blob: Blob;
  size: number;
  label: string;
  formattedSize: string;
  savingsPercent: number;
  status: 'success';
  timing?: StageTiming | undefined;
}

export interface WorkerResponseError {
  id: string;
  format: string;
  status: 'error';
  error: string;
}

export type WorkerResponse = WorkerResponseSuccess | WorkerResponseError;
