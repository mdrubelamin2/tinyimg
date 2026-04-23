import type { SvgInternalFormat } from '@/constants';
import type { TaskOptions } from '@/lib/queue/types';

export interface OptimizeTaskInput {
  id: string;
  buffer: ArrayBuffer;
  options: TaskOptions;
}

export interface OptimizeOptions {
  format: 'original' | 'webp' | 'avif' | 'jpeg' | 'png' | 'svg';
  svgInternalFormat: SvgInternalFormat;
  svgRasterizer?: 'auto' | 'browser' | 'resvg';
  svgExportDensity?: 'legacy' | 'display';
  svgDisplayDpr?: number;
}

export interface EncoderResult {
  encodedBytes: ArrayBuffer;
  mimeType: string;
  label: string;
  isLossless: boolean;
}

export interface EncoderStrategy {
  encode(input: OptimizeTaskInput): Promise<EncoderResult>;
}

export function svgPipelineOptionsFromWorker(options: TaskOptions) {
  return {
    svgInternalFormat: options.svgInternalFormat ?? ('webp' as const),
    svgRasterizer: options.svgRasterizer ?? ('resvg' as const),
    svgExportDensity: options.svgExportDensity ?? ('display' as const),
    svgDisplayDpr: options.svgDisplayDpr ?? 2,
  };
}
