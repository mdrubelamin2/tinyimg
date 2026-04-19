/**
 * Poolifier ThreadWorker entry: real module worker (no serialized main-thread callbacks).
 */

import './poolifier-worker-shim';
import { ThreadWorker } from 'poolifier-web-worker';
import type { TaskOptions, WorkerOutbound } from '@/lib/queue/types';
import { runOptimizeTask } from './optimize-task-core';

type Payload = { id: string; file: File; options: TaskOptions };

export default new ThreadWorker<Payload, WorkerOutbound>(
  async (data?: Payload) => {
    if (data == null) throw new Error('Missing optimizer payload');
    return runOptimizeTask({ id: data.id, file: data.file, options: data.options });
  },
  { maxInactiveTime: 10_000 }
);
