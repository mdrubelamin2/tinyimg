import * as Comlink from 'comlink'

import type { WorkerOutbound } from '@/lib/queue/types'

import type { OptimizePayload, OptimizerAPI } from './worker-pool-v2'

import { runOptimizeTask } from './optimize-task-core'

const optimizer: OptimizerAPI = {
  async optimize(payload: OptimizePayload): Promise<WorkerOutbound> {
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
    // Codecs load lazily on first use per format branch.
  },
}

globalThis.onmessage = (event: MessageEvent<{ port: MessagePort; type: string }>) => {
  if (event.data?.type === 'TASK_START') {
    const port = event.data.port
    Comlink.expose(optimizer, port)
    port.start()
  }
}
