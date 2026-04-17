import type { GlobalOptions } from '@/constants';

/** Field-wise equality for settings draft vs committed options (no JSON.stringify). */
export function globalOptionsEqual(a: GlobalOptions, b: GlobalOptions): boolean {
  return (
    a.useOriginalFormats === b.useOriginalFormats &&
    a.includeOriginalInCustom === b.includeOriginalInCustom &&
    a.smallFilesFirst === b.smallFilesFirst &&
    a.stripMetadata === b.stripMetadata &&
    a.svgInternalFormat === b.svgInternalFormat &&
    arraysEqual(a.formats, b.formats)
  );
}

function arraysEqual(x: string[], y: string[]): boolean {
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) return false;
  }
  return true;
}
