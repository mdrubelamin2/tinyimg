import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSetAtom } from 'jotai';
import { visibleItemIdsAtom } from '@/store/atoms/image-atoms';
import { ResultRowCells } from './ResultRowCells';
import type { ImageItem } from '@/lib/queue/types';

const ROW_HEIGHT = 88;
const OVERSCAN = 5;
const VISIBLE_ITEMS_DEBOUNCE_MS = 50; // Reduced from 150ms for faster response

export interface VirtualizedTableBodyProps {
  itemIds: string[];
  onRemove: (id: string) => void;
  onPreview?: ((item: ImageItem) => void) | undefined;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  gridClass?: string;
}

export const VirtualizedTableBody = ({
  itemIds,
  onRemove,
  onPreview,
  scrollRef,
  gridClass,
}: VirtualizedTableBodyProps) => {
  const setVisibleItems = useSetAtom(visibleItemIdsAtom);
  const debounceTimerRef = useRef<number | null>(null);
  
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: itemIds.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    // Disable dynamic measurement - row height is fixed at 88px
    // This prevents table jumping on state updates
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce visible items update to avoid excessive state updates during scroll
    // Use scheduler.postTask if available for better priority handling
    const updateVisibleItems = () => {
      const visibleIds = virtualRows
        .map(row => itemIds[row.index])
        .filter((id): id is string => !!id);
      setVisibleItems(new Set(visibleIds));
      debounceTimerRef.current = null;
    };

    debounceTimerRef.current = window.setTimeout(() => {
      // Use scheduler.postTask for priority-based scheduling if available
      if (typeof scheduler !== 'undefined' && typeof scheduler.postTask === 'function') {
        scheduler.postTask(updateVisibleItems, { priority: 'user-visible' }).catch(() => {
          // Fallback if postTask fails
          updateVisibleItems();
        });
      } else {
        updateVisibleItems();
      }
    }, VISIBLE_ITEMS_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [virtualRows, itemIds, setVisibleItems]);

  if (itemIds.length === 0) {
    return null;
  }

  return (
    <div className="relative" style={{ height: `${totalSize}px` }}>
      {virtualRows.map(virtualRow => {
        const id = itemIds[virtualRow.index];
        if (!id) return null;
        return (
          <div
            key={id}
            data-index={virtualRow.index}
            role="row"
            className="virtual-row absolute top-0 left-0 w-full border-b border-border/50 bg-surface/20 group hover:bg-muted/30 transition-colors duration-200"
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div className={`grid w-full ${gridClass || ''}`} role="rowgroup">
              <ResultRowCells id={id} onRemove={onRemove} onPreview={onPreview} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
