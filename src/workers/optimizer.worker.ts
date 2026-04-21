import type { TaskOptions, WorkerOutboundError } from '@/lib/queue/types';
import { runOptimizeTask } from './optimize-task-core';
import { toErrorMessage } from './raster-encode';

type Payload = { id: string; file: File | Blob; options: TaskOptions };

self.addEventListener('message', async (event: MessageEvent<Payload>) => {
  const data = event.data;
  try {
    if (data == null) throw new Error('Missing optimizer payload');

    const result = await runOptimizeTask({ id: data.id, file: data.file as File, options: data.options });
    if (result == null) {
      throw new Error('Optimizer returned no result');
    }

    const transferList: Transferable[] = [];
    if (result.type === 'RESULT' && result.encodedBytes instanceof ArrayBuffer) {
      transferList.push(result.encodedBytes);
    }

    self.postMessage(result, { transfer: transferList });
  } catch (err) {
    const payload: WorkerOutboundError = {
      type: 'ERROR',
      id: data?.id ?? '',
      resultId: data?.options?.resultId ?? '',
      format: data?.options?.format ?? '',
      error: toErrorMessage(err, 'Worker task failed'),
    };
    self.postMessage(payload);
  }
});
