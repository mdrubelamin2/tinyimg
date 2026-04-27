'use no memo';

import { imageStore$ } from '@/store/queue-store';
import { getImageStore } from '@/store/image-store';
import { prioritizeThumbnails } from '@/thumbnails/thumbnail-generator';
import { useValue } from '@legendapp/state/react';
import {
  startTransition,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
  useState,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  QUEUE_ROW_HEIGHT_PX,
} from './constants';
import { QueueTableHeaderRow } from './QueueTableHeaderRow';
import { QueueTableRow } from './QueueTableRow';
import { ResultRowCells } from './ResultRowCells';
import { StickyTableHead } from './StickyTableHead';
import { debounce } from 'es-toolkit';

export interface VirtualizedQueueTableBodyProps {
  scrollParent: HTMLDivElement | null;
}

export function VirtualizedQueueTableBody({
  scrollParent,
}: VirtualizedQueueTableBodyProps) {
  const itemIds = useValue(() => imageStore$.itemOrder.get());
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

  const getItemKey = useCallback((index: number) => itemIds[index] ?? index, [itemIds]);

  const rowVirtualizer = useVirtualizer({
    count: itemIds.length,
    getScrollElement: () => scrollParent,
    estimateSize: () => QUEUE_ROW_HEIGHT_PX,
    overscan: 5,
    getItemKey,
    useFlushSync: true,
    scrollMargin: headerHeight,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  useEffect(() => {
    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!firstItem || !lastItem) return;
    const start = firstItem.index;
    const end = lastItem.index;

    const debouncedUpdate = debounce((ids: string[]) => {
      startTransition(() => {
        prioritizeThumbnails(ids);
        getImageStore().setVisibleItems(ids);
      });
    }, 500);

    const visibleIds = itemIds.slice(start, end + 1);
    debouncedUpdate(visibleIds);

    return () => debouncedUpdate.cancel();
  }, [virtualItems, itemIds]);

  return (
    <div
      className="w-full min-w-0 relative"
      style={{ height: `${totalSize}px` }}
    >
      <StickyTableHead ref={headerRef}>
        <QueueTableHeaderRow />
      </StickyTableHead>
      {virtualItems.map((virtualRow) => {
        const rowId = itemIds[virtualRow.index];
        if (!rowId) return null;

        return (
          <QueueTableRow
            key={virtualRow.key}
            id={rowId}
            index={virtualRow.index}
            start={virtualRow.start}
            measureElement={rowVirtualizer.measureElement}
          >
            <ResultRowCells id={rowId} />
          </QueueTableRow>
        );
      })}
    </div>
  );
}
