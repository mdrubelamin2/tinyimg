import {
  SUPPORTED_FORMATS,
  isValidImageExtension,
  type GlobalOptions,
} from '@/constants';
import type { ImageItem } from '@/lib/queue/types';

function normalizeFormat(format: string): string {
  return format === 'jpg' ? 'jpeg' : format;
}

export function getFormatsToProcess(item: ImageItem, options: GlobalOptions): string[] {
  if (options.useOriginalFormats) {
    const normalizedOriginal = normalizeFormat(item.originalFormat);
    if (isValidImageExtension(normalizedOriginal)) {
      return [normalizedOriginal];
    }
    const fb = [...new Set(options.formats)];
    return fb.length > 0 ? fb : [...SUPPORTED_FORMATS];
  }

  const normalizedOriginal = normalizeFormat(item.originalFormat);
  const withOriginal = options.includeOriginalInCustom
    ? [normalizedOriginal, ...options.formats]
    : options.formats;

  return [...new Set(withOriginal)];
}
