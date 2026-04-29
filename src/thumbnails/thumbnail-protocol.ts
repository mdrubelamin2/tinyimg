export type ThumbnailWorkerInbound =
  | { buffer: ArrayBuffer; id: string; type: 'THUMB' }
  | { type: 'PING' }

export type ThumbnailWorkerOutbound =
  | { blob: Blob; height: number; id: string; type: 'THUMB_OK'; width: number }
  | { error: string; id: string; type: 'THUMB_ERR' }
  | { type: 'PONG' }
