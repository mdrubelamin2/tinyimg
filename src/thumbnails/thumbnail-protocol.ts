export type ThumbnailWorkerInbound =
  | { type: 'THUMB'; id: string; buffer: ArrayBuffer }
  | { type: 'PING' };

export type ThumbnailWorkerOutbound =
  | { type: 'THUMB_OK'; id: string; blob: Blob; width: number; height: number }
  | { type: 'THUMB_ERR'; id: string; error: string }
  | { type: 'PONG' };
