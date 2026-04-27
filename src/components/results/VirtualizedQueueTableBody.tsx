'use no memo';

import { getImageStore } from '@/store/image-store';
import { imageStore$ } from '@/store/queue-store';
import { prioritizeThumbnails } from '@/thumbnails/thumbnail-generator';
import { useValue } from '@legendapp/state/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { debounce } from 'es-toolkit';
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject
} from 'react';
import {
  QUEUE_OVERSCAN,
  QUEUE_ROW_HEIGHT_PX,
} from './constants';
import { QueueTableHeaderRow } from './QueueTableHeaderRow';
import { QueueTableRow } from './QueueTableRow';
import { ResultRowCells } from './ResultRowCells';
import { StickyTableHead } from './StickyTableHead';

export interface VirtualizedQueueTableBodyProps {
  scrollParent: RefObject<HTMLDivElement | null>;
}

export function VirtualizedQueueTableBody({
  scrollParent,
}: VirtualizedQueueTableBodyProps) {
  const itemIds = useValue(() => imageStore$.itemOrder.get());
  const deferredItemIds = useDeferredValue(itemIds);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderHeight(entry.target.getBoundingClientRect().height);
      }
    });

    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const getItemKey = useCallback((index: number) => deferredItemIds[index] ?? index, [deferredItemIds]);

  const rowVirtualizer = useVirtualizer({
    count: deferredItemIds.length,
    getScrollElement: () => scrollParent.current,
    estimateSize: () => QUEUE_ROW_HEIGHT_PX,
    overscan: QUEUE_OVERSCAN,
    getItemKey,
    scrollMargin: headerHeight,
    useFlushSync: false,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  useEffect(() => {
    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!firstItem || !lastItem) return;
    const start = firstItem.index;
    const end = lastItem.index;

    const visibleIds = deferredItemIds.slice(start, end + 1);
    const debouncedUpdate = debounce((ids: string[]) => {
      startTransition(() => {
        prioritizeThumbnails(ids);
        getImageStore().setVisibleItems(ids);
     });
    }, 300);
    debouncedUpdate(visibleIds);

    return () => debouncedUpdate.cancel();
  }, [virtualItems, deferredItemIds]);

  return (
    <div
      className="w-full min-w-0 relative"
      style={{ height: `${totalSize}px` }}
    >
      <StickyTableHead ref={headerRef}>
        <QueueTableHeaderRow />
      </StickyTableHead>
      {virtualItems.map((virtualRow) => {
        const rowId = deferredItemIds[virtualRow.index];
        if (!rowId) return null;

        return (
          <QueueTableRow
            key={virtualRow.key}
            id={rowId}
            index={virtualRow.index}
            start={virtualRow.start}
          >
            <ResultRowCells id={rowId} />
          </QueueTableRow>
        );
      })}
    </div>
  );
}
