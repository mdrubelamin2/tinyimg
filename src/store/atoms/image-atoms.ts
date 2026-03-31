/**
 * Jotai atoms for image state management.
 * Atomic state updates - only affected components re-render.
 */

import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
import type { ImageItem } from '@/lib/queue/types';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_PROCESSING } from '@/constants';

// --- Atom Family for per-item state ---
// Each item gets its own atom - updates only affect that item's subscribers
export const imageItemAtomFamily = atomFamily(
  () => atom<ImageItem | null>(null),
  (a, b) => a === b
);

// --- Global atoms ---
export const itemOrderAtom = atom<string[]>([]);
export const pendingIdsAtom = atom<Set<string>>(new Set<string>());
export const visibleItemIdsAtom = atom<Set<string>>(new Set<string>());

// --- Derived atoms (computed) ---

// Get all items as array (ordered)
export const itemsArrayAtom = atom((get) => {
  const order = get(itemOrderAtom);
  return order
    .map(id => get(imageItemAtomFamily(id)))
    .filter((item): item is ImageItem => item !== null);
});

// Item count
export const itemCountAtom = atom((get) => get(itemOrderAtom).length);

// Pending count
export const pendingCountAtom = atom((get) => get(pendingIdsAtom).size);

// Queue stats (replaces useQueueStats hook)
export const queueStatsAtom = atom((get) => {
  const items = get(itemsArrayAtom);

  let totalOriginal = 0;
  let totalOptimized = 0;
  let successfulCount = 0;
  let processingCount = 0;
  let hasFinishedItems = false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;

    totalOriginal += item.originalSize;

    if (item.status === STATUS_SUCCESS) {
      successfulCount++;
      hasFinishedItems = true;
    } else if (item.status === STATUS_ERROR) {
      hasFinishedItems = true;
    } else if (item.status === STATUS_PROCESSING) {
      processingCount++;
    }

    const results = item.results;
    for (const format in results) {
      const res = results[format];
      if (res && res.status === STATUS_SUCCESS && res.size) {
        totalOptimized += res.size;
      }
    }
  }

  const savingsPercent =
    totalOriginal > 0
      ? totalOptimized === 0
        ? '0'
        : ((totalOriginal - totalOptimized) / totalOriginal * 100).toFixed(1)
      : '0';

  const allDone =
    items.length > 0 &&
    processingCount === 0 &&
    items.every(item =>
      item.status === STATUS_SUCCESS ||
      item.status === STATUS_ERROR
    ) &&
    items.some(item => item.status === STATUS_SUCCESS || item.status === STATUS_ERROR);

  return {
    savingsPercent,
    allDone,
    successfulCount,
    hasFinishedItems,
    processingCount,
    doneCount: successfulCount,
  };
});

// All done flag
export const allDoneAtom = atom((get) => get(queueStatsAtom).allDone);

// Has errors flag
export const hasErrorsAtom = atom((get) => {
  const items = get(itemsArrayAtom);
  return items.some(item => item.status === STATUS_ERROR);
});

// Has finished items flag
export const hasFinishedItemsAtom = atom((get) => get(queueStatsAtom).hasFinishedItems);

// --- Derived selector atoms for fine-grained subscriptions (2026 pattern) ---
// Subscribe to specific fields instead of entire objects to prevent unnecessary re-renders

export const selectItemStatus = (id: string) =>
  atom((get) => get(imageItemAtomFamily(id))?.status);

export const selectItemResults = (id: string) =>
  atom((get) => get(imageItemAtomFamily(id))?.results);

export const selectItemFile = (id: string) =>
  atom((get) => get(imageItemAtomFamily(id))?.file);

export const selectItemOriginalSize = (id: string) =>
  atom((get) => get(imageItemAtomFamily(id))?.originalSize);
