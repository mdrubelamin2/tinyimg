/**
 * When persisted settings change and the queue is non-empty, push options into the image store
 * (replaces a React useEffect in App).
 */

import { getImageStore, imageStore$ } from '@/store/image-store';
import { useSettingsStore } from '@/store/settings-store';

export function initSettingsQueueBridge(): () => void {
  return useSettingsStore.subscribe((state, prev) => {
    if (prev && prev.options === state.options) return;
    if (imageStore$.itemOrder.peek().length === 0) return;
    getImageStore().applyGlobalOptions(state.options, false);
  });
}
