import {
  DEFAULT_MIME,
  ID_RANDOM_LENGTH,
  STATUS_PENDING,
  type GlobalOptions,
} from '@/constants';
import { revokeResultUrls } from '@/lib/download';
import { buildOutputSlots } from '@/lib/queue/output-slots';
import type { IntakeOriginalKind } from '@/lib/queue/queue-intake';
import type { ImageItem, ImageResult } from '@/lib/queue/types';
import { nanoid } from 'nanoid';

export { getFormatsToProcess } from '@/lib/queue/formats-to-process';

export function createQueueItem(
  file: File,
  options: GlobalOptions,
  intakeKind: IntakeOriginalKind
): ImageItem {
  if (/\.zip$/i.test(file.name)) {
    throw new Error('Queue items must not be created for raw .zip archives (expand in intake first)');
  }

  const item: ImageItem = {
    id: nanoid(ID_RANDOM_LENGTH),
    fileName: file.name,
    mimeType: file.type || DEFAULT_MIME,
    originalSourceKind: intakeKind === 'direct' ? 'direct' : 'storage',
    status: STATUS_PENDING,
    progress: 0,
    originalSize: file.size,
    originalFormat: file.name.split('.').pop()?.toLowerCase() ?? 'unknown',
    results: {},
  };

  const slots = buildOutputSlots(item, options);
  for (const slot of slots) {
    item.results[slot.resultId] = {
      resultId: slot.resultId,
      format: slot.format,
      variantLabel: slot.variantLabel,
      status: STATUS_PENDING,
    };
  }

  return item;
}

export function resetItemResultsForOptions(
  item: ImageItem,
  options: GlobalOptions
): ImageItem {
  revokeResultUrls(item);
  const slots = buildOutputSlots(item, options);
  const results: Record<string, ImageResult> = {};

  for (const slot of slots) {
    results[slot.resultId] = {
      resultId: slot.resultId,
      format: slot.format,
      variantLabel: slot.variantLabel,
      status: STATUS_PENDING,
    };
  }

  return { ...item, status: STATUS_PENDING, progress: 0, results };
}

