/**
 * Reactive queue stats (savings, counts, heuristic estimate) from shared computed state.
 */

import { useValue } from '@legendapp/state/react';
import { queueStats$, type QueueStats } from '@/state/queue-stats';

export type { QueueStats };

export function useQueueStats(): QueueStats {
  return useValue(() => queueStats$.get());
}
