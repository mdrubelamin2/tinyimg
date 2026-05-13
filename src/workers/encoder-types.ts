import type { SvgInternalFormat } from '@/constants'
import type { TaskOptions } from '@/lib/queue/types'

export interface EncoderResult {
  encodedBytes: ArrayBuffer
  isLossless: boolean
  label: string
  mimeType: string
}

export interface EncoderStrategy {
  encode(input: StrategyInput): Promise<EncoderResult>
}

export interface OptimizeOptions {
  format: 'avif' | 'jpeg' | 'original' | 'png' | 'svg' | 'webp'
  svgDisplayDpr?: number
  svgExportDensity?: 'display' | 'legacy'
  svgInternalFormat: SvgInternalFormat
  svgRasterizer?: 'auto' | 'browser' | 'resvg'
}

export interface OptimizeTaskInput {
  file: File
  id: string
  options: TaskOptions
}

export interface StrategyInput extends OptimizeTaskInput {
  buffer: ArrayBuffer
}

export function svgPipelineOptionsFromWorker(options: TaskOptions) {
  return {
    svgDisplayDpr: options.svgDisplayDpr ?? 2,
    svgExportDensity: options.svgExportDensity ?? ('display' as const),
    svgInternalFormat: options.svgInternalFormat ?? ('webp' as const),
    svgRasterizer: options.svgRasterizer ?? ('resvg' as const),
  }
}
