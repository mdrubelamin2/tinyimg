/**
 * Shared types for the queue system, worker protocol, and task management.
 * This is the single source of truth for data shapes across main thread and workers.
 */

import type {
  ItemStatus,
  SvgInternalFormat,
  LosslessEncoding,
  GlobalOptions,
} from '@/constants';

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
// Resize intent (worker resolves target pixels from source + preset)
// ---------------------------------------------------------------------------
export type TaskResizePreset =
  | { kind: 'native' }
  | { kind: 'target'; maintainAspect: boolean; width: number; height: number };

// ---------------------------------------------------------------------------
// Image result (one per output slot: format × size)
// ---------------------------------------------------------------------------
export interface ImageResult {
  /** Stable map key and storage suffix (`out:id:resultId`) */
  resultId: string;
  /** Encode / MIME format (e.g. webp, jpeg) */
  format: string;
  /** Short size variant label from config (e.g. 800w, 1200×800) */
  variantLabel?: string | undefined;
  label?: string | undefined;
  /** Session hybrid storage key (`out:id:resultId`); encoded bytes live here, not in Legend state */
  payloadKey?: string | undefined;
  size?: number | undefined;
  formattedSize?: string | undefined;
  savingsPercent?: number | undefined;
  downloadUrl?: string | undefined;
  status: ItemStatus;
  error?: string | undefined;
}

/** Where the original lives: in-memory drop map vs hybrid `src:${id}` (ZIP / folder-expanded). */
export type OriginalSourceKind = 'direct' | 'storage';

// ---------------------------------------------------------------------------
// Queue item (one per uploaded file)
// ---------------------------------------------------------------------------
export interface ImageItem {
  id: string;
  /** Original filename for display and download naming */
  fileName: string;
  /** MIME type for thumbnails and decoding */
  mimeType: string;
  /** `direct` → in-memory drop map by id; `storage` → hybrid session `src:${id}` */
  originalSourceKind: OriginalSourceKind;
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
  resultId: string;
  format: string;
  svgInternalFormat: SvgInternalFormat;
  svgRasterizer: 'auto' | 'browser' | 'resvg';
  svgExportDensity: 'legacy' | 'display';
  svgDisplayDpr: number;
  qualityPercent: number;
  resizePreset: TaskResizePreset;
  stripMetadata: boolean;
  losslessEncoding: LosslessEncoding;
}

// ---------------------------------------------------------------------------
// Task (queued unit of work for the worker pool)
// ---------------------------------------------------------------------------
export interface Task {
  id: string;
  resultId: string;
  format: string;
  file: File;
  options: TaskOptions;
}

// ---------------------------------------------------------------------------
// Worker protocol — Discriminated unions for typed messaging
// ---------------------------------------------------------------------------

/** Main thread → Worker messages */
export type WorkerInbound =
  | { type: 'OPTIMIZE'; id: string; file: File; options: TaskOptions }
  | { type: 'CANCEL'; id: string }
  | { type: 'PRELOAD_CODEC'; format: string };

/** Worker → Main thread messages */
export type WorkerOutbound =
  | WorkerOutboundProgress
  | WorkerOutboundResult
  | WorkerOutboundError
  | WorkerOutboundCancelled;

export interface WorkerOutboundProgress {
  type: 'PROGRESS';
  id: string;
  stage: PipelineStage;
  percent: number;
}

export interface WorkerOutboundResult {
  type: 'RESULT';
  id: string;
  resultId: string;
  format: string;
  /** Encoded bytes (structured-clone from worker; prefer detached buffer). */
  encodedBytes: ArrayBuffer;
  mimeType: string;
  size: number;
  label: string;
  formattedSize: string;
  savingsPercent: number;
}

export interface WorkerOutboundError {
  type: 'ERROR';
  id: string;
  resultId: string;
  format: string;
  error: string;
}

export interface WorkerOutboundCancelled {
  type: 'CANCELLED';
  id: string;
}
