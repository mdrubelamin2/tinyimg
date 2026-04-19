import {
  STATUS_PENDING,
  STATUS_PROCESSING,
  STATUS_SUCCESS,
  STATUS_ERROR,
} from '@/constants';
import type { ImageItem } from '@/lib/queue/types';

export function queueRowAriaLabel(item: Pick<ImageItem, 'status' | 'fileName'>): string {
  const state =
    item.status === STATUS_PENDING
      ? 'Queued'
      : item.status === STATUS_PROCESSING
        ? 'Processing'
        : item.status === STATUS_SUCCESS
          ? 'Completed'
          : item.status === STATUS_ERROR
            ? 'Error'
            : item.status;
  return `${item.fileName}, ${state}`;
}
