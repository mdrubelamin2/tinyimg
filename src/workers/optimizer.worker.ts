import * as Comlink from 'comlink'

import type { WorkerOutbound } from '@/lib/queue/types'

import type { OptimizePayload, OptimizerAPI } from './worker-pool-v2'

import { runOptimizeTask } from './optimize-task-core'
import { ensureHeicDecoder, ensureHeicEncoder, ensureQuant, ensureResvg } from './optimizer-wasm'

/**
 * Hot WASM pre-initialization.
 * Triggers loading as soon as the worker script is parsed.
 */
const wasmReady = Promise.all([
  ensureResvg().catch((error) => console.warn('Pre-init Resvg failed', error)),
  ensureQuant().catch((error) => console.warn('Pre-init Quant failed', error)),
  ensureHeicDecoder().catch((error) => console.warn('Pre-init Heic Decoder failed', error)),
  ensureHeicEncoder().catch((error) => console.warn('Pre-init Heic Encoder failed', error)),
])

const optimizer: OptimizerAPI = {
  async optimize(payload: OptimizePayload): Promise<WorkerOutbound> {
    await wasmReady
    const result = await runOptimizeTask({
      file: payload.file,
      id: payload.id,
      options: payload.options,
    })

    if (result.type === 'RESULT' && result.encodedBytes instanceof ArrayBuffer) {
      return Comlink.transfer(result, [result.encodedBytes])
    }
    return result
  },
}

globalThis.onmessage = (event: MessageEvent<{ port: MessagePort; type: string }>) => {
  if (event.data?.type === 'INIT') {
    const port = event.data.port
    Comlink.expose(optimizer, port)
    port.start()
  } else if (event.data?.type === 'TASK_START') {
    const port = event.data.port
    Comlink.expose(optimizer, port)
    port.start()
  }
}
