/**
 * Centralized error types and messages. Single source for user-facing and programmatic errors.
 */

import {
  ERR_FILE_EXCEEDS_LIMIT,
  ERR_ZIP_EXCEEDS_LIMIT,
  ERR_INVALID_FILE,
  ERR_WORKER,
  ERR_TASK_TIMEOUT,
} from '../constants';

export type AppErrorCode =
  | 'VALIDATION_FILE_LIMIT'
  | 'VALIDATION_ZIP_LIMIT'
  | 'VALIDATION_INVALID_FILE'
  | 'WORKER_ERROR'
  | 'TASK_TIMEOUT';

export interface AppError {
  code: AppErrorCode;
  message: string;
}

function createError(code: AppErrorCode, message: string): AppError {
  return { code, message };
}

export const ValidationErrors = {
  fileExceedsLimit: (): AppError => createError('VALIDATION_FILE_LIMIT', ERR_FILE_EXCEEDS_LIMIT),
  zipExceedsLimit: (): AppError => createError('VALIDATION_ZIP_LIMIT', ERR_ZIP_EXCEEDS_LIMIT),
  invalidFile: (): AppError => createError('VALIDATION_INVALID_FILE', ERR_INVALID_FILE),
} as const;

export const WorkerErrors = {
  workerError: (): AppError => createError('WORKER_ERROR', ERR_WORKER),
  taskTimeout: (): AppError => createError('TASK_TIMEOUT', ERR_TASK_TIMEOUT),
} as const;

/** Get user-facing message from an AppError or unknown. */
export function toUserMessage(err: AppError | unknown): string {
  if (err != null && typeof err === 'object' && 'message' in err && typeof (err as AppError).message === 'string') {
    return (err as AppError).message;
  }
  if (err instanceof Error) return err.message;
  return String(err ?? 'Unknown error');
}
