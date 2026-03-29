import {
  STATUS_PENDING,
  STATUS_PROCESSING,
  STATUS_SUCCESS,
  STATUS_ERROR,
  ERR_WORKER,
} from '@/constants';
import type {
  ImageItem,
  Task,
  WorkerResponse,
  WorkerResponseError,
  WorkerResponseSuccess,
  WorkerOutboundResult,
  WorkerOutboundError,
} from '@/lib/queue/types';

function hasProcessingResults(item: ImageItem): boolean {
  return Object.values(item.results).some(
    (result) =>
      result.status === STATUS_PROCESSING || result.status === STATUS_PENDING
  );
}

export function applyWorkerTaskError(
  queue: ImageItem[],
  task: Task | null
): ImageItem[] {
  if (!task) return queue;

  const index = queue.findIndex((item) => item.id === task.id);
  if (index === -1) return queue;

  const nextQueue = [...queue];
  const existing = nextQueue[index]!;
  const item: ImageItem = { ...existing, results: { ...existing.results } };
  const result = item.results[task.format];
  if (result) {
    item.results[task.format] = { ...result, status: STATUS_ERROR, error: ERR_WORKER };
  }

  if (!hasProcessingResults(item)) {
    item.status = STATUS_ERROR;
    item.progress = 100;
  }

  nextQueue[index] = item;
  return nextQueue;
}

export function applyWorkerResponse(
  queue: ImageItem[],
  response: WorkerResponse | WorkerOutboundResult | WorkerOutboundError
): ImageItem[] {
  const responseId = 'id' in response ? response.id : '';
  const index = queue.findIndex((item) => item.id === responseId);
  if (index === -1) return queue;

  const nextQueue = [...queue];
  const existing = nextQueue[index]!;
  const item: ImageItem = { ...existing, results: { ...existing.results } };
  const format = response.format;
  const result = item.results[format];
  if (!result) return queue;

  if ('status' in response && response.status === STATUS_SUCCESS) {
    const success = response as WorkerResponseSuccess;
    if (result.downloadUrl) {
      URL.revokeObjectURL(result.downloadUrl);
    }
    const downloadUrl = URL.createObjectURL(success.blob);
    item.results[format] = {
      ...result,
      status: STATUS_SUCCESS,
      size: success.size,
      blob: success.blob,
      label: success.label,
      downloadUrl,
    };
  } else if ('type' in response && response.type === 'RESULT') {
    const outbound = response as WorkerOutboundResult;
    if (result.downloadUrl) {
      URL.revokeObjectURL(result.downloadUrl);
    }
    const downloadUrl = URL.createObjectURL(outbound.blob);
    item.results[format] = {
      ...result,
      status: STATUS_SUCCESS,
      size: outbound.size,
      blob: outbound.blob,
      label: outbound.label,
      downloadUrl,
    };
  } else {
    const error = response as WorkerResponseError | WorkerOutboundError;
    item.results[format] = { ...result, status: STATUS_ERROR, error: error.error };
  }

  if (!hasProcessingResults(item)) {
    const anyError = Object.values(item.results).some(
      (r) => r.status === STATUS_ERROR
    );
    item.status = anyError ? STATUS_ERROR : STATUS_SUCCESS;
    item.progress = 100;
  }

  nextQueue[index] = item;
  return nextQueue;
}
