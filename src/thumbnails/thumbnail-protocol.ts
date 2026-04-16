export type ThumbnailWorkerInbound =
  | { type: 'THUMB'; id: string; file: File }
  | { type: 'PING' };

export type ThumbnailWorkerOutbound =
  | { type: 'THUMB_OK'; id: string; blob: Blob }
  | { type: 'THUMB_ERR'; id: string; error: string }
  | { type: 'PONG' };
