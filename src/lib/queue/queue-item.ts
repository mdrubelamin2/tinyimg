import {
  STATUS_PENDING,
  type GlobalOptions,
} from '@/constants';
import type { ImageItem, ImageResult, OPFSFileMetadata } from './types';

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

export function createQueueItem(metadata: OPFSFileMetadata, options: GlobalOptions): ImageItem {
  const item: ImageItem = {
    id: metadata.id,
    fileHandle: metadata.handle,
    fileName: metadata.name,
    fileSize: metadata.size,
    status: STATUS_PENDING,
    progress: 0,
    originalSize: metadata.size,
    originalFormat: metadata.name.split('.').pop()?.toLowerCase() ?? 'unknown',
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
  const formats = getFormatsToProcess(item, options);
  const results: Record<string, ImageResult> = {};

  // Preserve existing successful results if format is still needed
  for (const format of formats) {
    const existingResult = item.results[format];
    
    if (existingResult && existingResult.status === 'success') {
      // Keep successful result, don't re-process
      results[format] = existingResult;
    } else {
      // New format or failed result, mark as pending
      results[format] = { format, status: STATUS_PENDING };
    }
  }

  // Revoke URLs only for formats that are no longer needed
  const removedFormats = Object.keys(item.results).filter(f => !formats.includes(f));
  for (const format of removedFormats) {
    const result = item.results[format];
    if (result?.downloadUrl) {
      URL.revokeObjectURL(result.downloadUrl);
    }
  }

  return { ...item, status: STATUS_PENDING, progress: 0, results };
}