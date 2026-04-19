/**
 * Cartesian product of output formats × size presets for queue items.
 */

import {
  RESIZE_MAX_EDGE_MAX,
  type GlobalOptions,
  type OutputSizePreset,
} from '@/constants';
import type { ImageItem, TaskResizePreset } from '@/lib/queue/types';
import { getFormatsToProcess } from '@/lib/queue/formats-to-process';

export interface OutputSlot {
  resultId: string;
  format: string;
  variantLabel: string;
  resizePreset: TaskResizePreset;
}

function sanitizeFormatForId(format: string): string {
  return format.replace(/[^a-z0-9_-]/gi, '_');
}

/** Stable suffix for a size preset row (custom sizes mode). */
export function sizePresetResultSuffix(preset: OutputSizePreset): string {
  if (preset.maintainAspect) {
    if (preset.width > 0) return `w${preset.width}`;
    if (preset.height > 0) return `h${preset.height}`;
    return 'invalid';
  }
  return `${preset.width}x${preset.height}`;
}

function variantLabelFromPreset(preset: OutputSizePreset): string {
  if (preset.maintainAspect) {
    if (preset.width > 0) return `${preset.width}w`;
    if (preset.height > 0) return `${preset.height}h`;
    return '—';
  }
  return `${preset.width}×${preset.height}`;
}

function dedupePresets(presets: OutputSizePreset[]): OutputSizePreset[] {
  const seen = new Set<string>();
  const out: OutputSizePreset[] = [];
  for (const p of presets) {
    const key = `${p.maintainAspect}:${p.width}:${p.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function validCustomPresets(presets: OutputSizePreset[]): OutputSizePreset[] {
  return dedupePresets(presets).filter((p) => {
    if (p.maintainAspect) {
      if (p.width > 0) return p.width <= RESIZE_MAX_EDGE_MAX;
      if (p.height > 0) return p.height <= RESIZE_MAX_EDGE_MAX;
      return false;
    }
    return (
      p.width >= 1 &&
      p.width <= RESIZE_MAX_EDGE_MAX &&
      p.height >= 1 &&
      p.height <= RESIZE_MAX_EDGE_MAX
    );
  });
}

/**
 * SVG file + vector SVG output: dimensions do not apply; single slot per that format.
 */
/** SVG asset + SVG (vector) output — size variants are not meaningful. */
function isVectorSvgSlot(item: ImageItem, format: string): boolean {
  return item.originalFormat === 'svg' && format === 'svg';
}

/**
 * Build ordered output slots (format × size). When `useOriginalSizes`, resultId equals `format` for backward compatibility.
 */
export function buildOutputSlots(item: ImageItem, options: GlobalOptions): OutputSlot[] {
  const formats = getFormatsToProcess(item, options);
  const slots: OutputSlot[] = [];

  if (options.useOriginalSizes) {
    for (const format of formats) {
      if (isVectorSvgSlot(item, format)) {
        slots.push({
          resultId: format,
          format,
          variantLabel: '',
          resizePreset: { kind: 'native' },
        });
        continue;
      }
      slots.push({
        resultId: format,
        format,
        variantLabel: '',
        resizePreset: { kind: 'native' },
      });
    }
    return slots;
  }

  const presets = validCustomPresets(options.customSizePresets);
  const sizeSteps: { suffix: string; label: string; preset: TaskResizePreset }[] = [];

  for (const p of presets) {
    const suffix = sizePresetResultSuffix(p);
    if (suffix === 'invalid') continue;
    sizeSteps.push({
      suffix,
      label: variantLabelFromPreset(p),
      preset: {
        kind: 'target' as const,
        maintainAspect: p.maintainAspect,
        width: p.width,
        height: p.height,
      },
    });
  }

  if (options.includeNativeSizeInCustom || sizeSteps.length === 0) {
    sizeSteps.push({
      suffix: '',
      label: 'Original',
      preset: { kind: 'native' },
    });
  }

  const fmtPart = (format: string) => sanitizeFormatForId(format);

  for (const format of formats) {
    if (isVectorSvgSlot(item, format)) {
      slots.push({
        resultId: format,
        format,
        variantLabel: '',
        resizePreset: { kind: 'native' },
      });
      continue;
    }

    for (const step of sizeSteps) {
      const resultId = `${fmtPart(format)}__${step.suffix}`;
      slots.push({
        resultId,
        format,
        variantLabel: step.label,
        resizePreset: step.preset,
      });
    }
  }

  return slots;
}

/** Count slots for explosion warnings in UI. */
export function countOutputSlots(item: ImageItem, options: GlobalOptions): number {
  return buildOutputSlots(item, options).length;
}
