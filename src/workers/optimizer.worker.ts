import type { TaskOptions } from '@/lib/queue/types';
import { runOptimizeTask } from './optimize-task-core';

type Payload = { id: string; file: File | Blob; options: TaskOptions };

self.addEventListener('message', async (event: MessageEvent<Payload>) => {
  try {
    const data = event.data;
    if (data == null) throw new Error('Missing optimizer payload');
    
    const result = await runOptimizeTask({ id: data.id, file: data.file as File, options: data.options });
    
    const transferList: Transferable[] = [];
    if (result.type === 'RESULT' && result.encodedBytes instanceof ArrayBuffer) {
      transferList.push(result.encodedBytes);
    }
    
    self.postMessage(result, { transfer: transferList });
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: String(err) });
  }
});
