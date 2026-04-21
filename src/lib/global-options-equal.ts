import type { GlobalOptions, OutputSizePreset } from '@/constants';

/** Field-wise equality for settings draft vs committed options (no JSON.stringify). */
export function globalOptionsEqual(a: GlobalOptions, b: GlobalOptions): boolean {
  return (
    a.useOriginalFormats === b.useOriginalFormats &&
    a.includeOriginalInCustom === b.includeOriginalInCustom &&
    a.useOriginalSizes === b.useOriginalSizes &&
    a.includeNativeSizeInCustom === b.includeNativeSizeInCustom &&
    a.stripMetadata === b.stripMetadata &&
    a.svgInternalFormat === b.svgInternalFormat &&
    arraysEqual(a.formats, b.formats) &&
    sizePresetsEqual(a.customSizePresets, b.customSizePresets)
  );
}

function arraysEqual(x: string[], y: string[]): boolean {
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) return false;
  }
  return true;
}

function sizePresetsEqual(x: OutputSizePreset[], y: OutputSizePreset[]): boolean {
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) {
    const p = x[i]!;
    const q = y[i]!;
    if (
      p.id !== q.id ||
      p.width !== q.width ||
      p.height !== q.height ||
      p.maintainAspect !== q.maintainAspect
    ) {
      return false;
    }
  }
  return true;
}
