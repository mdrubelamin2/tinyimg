import * as Comlink from 'comlink';
import type { WorkerOutbound } from '@/lib/queue/types';
import { runOptimizeTask } from './optimize-task-core';
import type { OptimizePayload, OptimizerAPI } from './worker-pool-v2';
import { ensureResvg, ensureQuant } from './optimizer-wasm';

/**
 * Hot WASM pre-initialization.
 * Triggers loading as soon as the worker script is parsed.
 */
const wasmReady = Promise.all([
  ensureResvg().catch(err => console.warn('Pre-init Resvg failed', err)),
  ensureQuant().catch(err => console.warn('Pre-init Quant failed', err)),
]);

const optimizer: OptimizerAPI = {
  async optimize(payload: OptimizePayload): Promise<WorkerOutbound> {
    await wasmReady;
    const result = await runOptimizeTask({
      id: payload.id,
      buffer: payload.buffer,
      options: payload.options,
    });

    if (result.type === 'RESULT' && result.encodedBytes instanceof ArrayBuffer) {
      return Comlink.transfer(result, [result.encodedBytes]);
    }
    return result;
  }
};

self.onmessage = (event: MessageEvent<{ type: string; port: MessagePort }>) => {
  if (event.data?.type === 'INIT') {
    const port = event.data.port;
    Comlink.expose(optimizer, port);
    port.start();
  } else if (event.data?.type === 'TASK_START') {
    const port = event.data.port;
    Comlink.expose(optimizer, port);
    port.start();
  }
};
