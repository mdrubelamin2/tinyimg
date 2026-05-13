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
  ensureResvg(),
  ensureQuant(),
  ensureHeicDecoder(),
  ensureHeicEncoder(),
])

const optimizer: OptimizerAPI = {
  async optimize(payload: OptimizePayload): Promise<WorkerOutbound> {
    try {
      await wasmReady
    } catch (error) {
      return {
        error: `WASM Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        format: payload.options.format,
        id: payload.id,
        resultId: payload.options.resultId,
        type: 'ERROR',
      }
    }

    const result = await runOptimizeTask({
      file: payload.file,
      id: payload.id,
      options: payload.options,
    })

    if (
      result.type === 'RESULT' &&
      result.encodedBytes instanceof ArrayBuffer &&
      result.encodedBytes.byteLength > 0
    ) {
      return Comlink.transfer(result, [result.encodedBytes])
    }
    return result
  },

  async preloadWasm() {
    await wasmReady
  },
}

globalThis.onmessage = (event: MessageEvent<{ port: MessagePort; type: string }>) => {
  if (event.data?.type === 'TASK_START') {
    const port = event.data.port
    Comlink.expose(optimizer, port)
    port.start()
  }
}
