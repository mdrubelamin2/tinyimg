import {
  ID_RANDOM_LENGTH,
  STATUS_PENDING,
  type GlobalOptions,
} from '@/constants';
import type { ImageItem, ImageResult } from '@/lib/queue-types';
import { revokeResultUrls } from '@/lib/download';

function normalizeFormat(format: string): string {
  return format === 'jpg' ? 'jpeg' : format;
}

export function getFormatsToProcess(item: ImageItem, options: GlobalOptions): string[] {
  if (options.useOriginalFormats) {
    return [normalizeFormat(item.originalFormat)];
  }

  const normalizedOriginal = normalizeFormat(item.originalFormat);
  const withOriginal = options.includeOriginalInCustom
    ? [normalizedOriginal, ...options.formats]
    : options.formats;

  return [...new Set(withOriginal)];
}

export function createQueueItem(file: File, options: GlobalOptions): ImageItem {
  const item: ImageItem = {
    id: Math.random().toString(36).substring(2, 2 + ID_RANDOM_LENGTH),
    file,
    previewUrl: URL.createObjectURL(file),
    status: STATUS_PENDING,
    progress: 0,
    originalSize: file.size,
    originalFormat: file.name.split('.').pop()?.toLowerCase() ?? 'unknown',
    results: {},
  };

  const formats = getFormatsToProcess(item, options);
  for (const format of formats) {
    item.results[format] = { format, status: STATUS_PENDING };
  }

  return item;
}

export function resetItemResultsForOptions(
  item: ImageItem,
  options: GlobalOptions
): ImageItem {
  revokeResultUrls(item);
  const formats = getFormatsToProcess(item, options);
  const results: Record<string, ImageResult> = {};

  for (const format of formats) {
    results[format] = { format, status: STATUS_PENDING };
  }

  return { ...item, status: STATUS_PENDING, progress: 0, results };
}

