/**
 * Optimizer worker entry: thin adapter for Vite `?worker` builds.
 * Heavy logic lives in optimize-task-core (shared with multithreading.js pool).
 */

import { runOptimizeTask } from './optimize-task-core';

self.onmessage = async (e: MessageEvent) => {
  if (e.data.type === 'CANCEL') {
    self.postMessage({ type: 'CANCELLED', id: e.data.id });
    return;
  }

  const { file, options, id } = e.data;
  const out = await runOptimizeTask({ id, file, options });
  self.postMessage(out);
};
