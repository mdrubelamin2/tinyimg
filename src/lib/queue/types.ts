/**
 * Shared types for the queue system, worker protocol, and task management.
 * This is the single source of truth for data shapes across main thread and workers.
 */

import type { ItemStatus, LosslessEncoding, SvgInternalFormat } from '@/constants'

// ---------------------------------------------------------------------------
// Queue item (one per uploaded file)
// ---------------------------------------------------------------------------
export interface ImageItem {
  error?: string | undefined
  /** Original filename for display and download naming */
  fileName: string
  formattedOriginalSize?: string | undefined
  height?: number | undefined
  id: string
  /** MIME type for thumbnails and decoding */
  mimeType: string
  originalFormat: string
  originalSize: number
  /** `direct` → in-memory drop map by id; `storage` → hybrid session `src:${id}` */
  originalSourceKind: OriginalSourceKind
  /** Per-item format override (null = follow global config) */
  outputFormatsOverride?: null | string[] | undefined
  previewUrl?: string | undefined
  progress: number
  /** Per-item quality override (null = follow global config) */
  qualityPercentOverride?: null | number | undefined
  results: Record<string, ImageResult>
  status: ItemStatus
  width?: number | undefined
}

// ---------------------------------------------------------------------------
// Image result (one per output slot: format × size)
// ---------------------------------------------------------------------------
export interface ImageResult {
  downloadUrl?: string | undefined
  error?: string | undefined
  /** Encode / MIME format (e.g. webp, jpeg) */
  format: string
  formattedSize?: string | undefined
  label?: string | undefined
  lossless?: boolean
  /** Session hybrid storage key (`out:id:resultId`); encoded bytes live here, not in Legend state */
  payloadKey?: string | undefined
  /** Stable map key and storage suffix (`out:id:resultId`) */
  resultId: string
  savingsPercent?: number | undefined
  size?: number | undefined
  status: ItemStatus
  /** Short size variant label from config (e.g. 800w, 1200×800) */
  variantLabel?: string | undefined
}

/** Where the original lives: in-memory drop map vs hybrid `src:${id}` (ZIP / folder-expanded). */
export type OriginalSourceKind = 'direct' | 'storage'

// ---------------------------------------------------------------------------
// Pipeline stages (for granular progress reporting)
// ---------------------------------------------------------------------------
export type PipelineStage =
  | 'classify'
  | 'decode'
  | 'encode'
  | 'resize'
  | 'svg-optimize'
  | 'svg-rasterize'

// ---------------------------------------------------------------------------
// Task (queued unit of work for the worker pool)
// ---------------------------------------------------------------------------
export interface Task {
  file: File
  format: string
  id: string
  options: TaskOptions
  resultId: string
}

// ---------------------------------------------------------------------------
// Task options (sent to the worker for each encode job)
// ---------------------------------------------------------------------------
export interface TaskOptions {
  format: string
  losslessEncoding: LosslessEncoding
  originalExtension?: string
  originalSize: number
  qualityPercent: number
  resizePreset: TaskResizePreset
  resultId: string
  stripMetadata: boolean
  svgDisplayDpr: number
  svgExportDensity: 'display' | 'legacy'
  svgInternalFormat: SvgInternalFormat
  svgRasterizer: 'auto' | 'browser' | 'resvg'
}

// ---------------------------------------------------------------------------
// Resize intent (worker resolves target pixels from source + preset)
// ---------------------------------------------------------------------------
export type TaskResizePreset =
  | { height: number; kind: 'target'; maintainAspect: boolean; width: number }
  | { kind: 'native' }

// ---------------------------------------------------------------------------
// Worker protocol — Discriminated unions for typed messaging
// ---------------------------------------------------------------------------

/** Main thread → Worker messages */
export type WorkerInbound =
  | { file: File; id: string; options: TaskOptions; type: 'OPTIMIZE' }
  | { format: string; type: 'PRELOAD_CODEC' }
  | { id: string; type: 'CANCEL' }

/** Worker → Main thread messages */
export type WorkerOutbound =
  | WorkerOutboundCancelled
  | WorkerOutboundError
  | WorkerOutboundProgress
  | WorkerOutboundResult

export interface WorkerOutboundCancelled {
  id: string
  type: 'CANCELLED'
}

export interface WorkerOutboundError {
  error: string
  format: string
  id: string
  resultId: string
  type: 'ERROR'
}

export interface WorkerOutboundProgress {
  id: string
  percent: number
  stage: PipelineStage
  type: 'PROGRESS'
}

export interface WorkerOutboundResult {
  /** Encoded bytes (structured-clone from worker; prefer detached buffer). */
  encodedBytes: ArrayBuffer
  format: string
  formattedSize: string
  id: string
  label: string
  lossless: boolean
  mimeType: string
  resultId: string
  savingsPercent: number
  size: number
  type: 'RESULT'
}

export { type GlobalOptions } from '@/constants'
