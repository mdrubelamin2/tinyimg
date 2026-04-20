import { cn } from '@/lib/utils';
import { imageStore$ } from '@/store/image-store';
import { prioritizeThumbnails } from '@/thumbnails/thumbnail-generator';
import { useValue } from '@legendapp/state/react';
import { startTransition, useCallback, type HTMLAttributes } from 'react';
import type { ListRange } from 'react-virtuoso';
import { TableVirtuoso } from 'react-virtuoso';
import {
  QUEUE_ROW_HEIGHT_PX,
  QUEUE_VIRTUOSO_OVERSCAN_MAIN_PX,
  QUEUE_VIRTUOSO_OVERSCAN_REVERSE_PX,
} from './constants';
import { QueueTableHeaderRow } from './QueueTableHeaderRow';
import { QueueTableVirtuosoRow } from './QueueTableVirtuosoRow';
import { ResultRowCells } from './ResultRowCells';
import { StickyTableHead } from './StickyTableHead';

export interface VirtualizedQueueTableBodyProps {
  scrollParent: HTMLDivElement | null;
}

export function VirtualizedQueueTableBody({
  scrollParent,
}: VirtualizedQueueTableBodyProps) {
  const itemIds = useValue(() => imageStore$.itemOrder.get());

  const onRangeChanged = (range: ListRange) => {
    startTransition(() => {
      const visibleIds = itemIds.slice(range.startIndex, range.endIndex + 1);
      prioritizeThumbnails(visibleIds);
      imageStore$.visibleItemIds.set(visibleIds);
    })
  }

  const itemContent = useCallback((_index: number, rowId: string) => (
    <ResultRowCells key={rowId} id={rowId} />
  ), []);

  if (itemIds.length === 0 || !scrollParent) {
    return null;
  }

  return (
    <TableVirtuoso
      customScrollParent={scrollParent}
      data={itemIds}
      defaultItemHeight={QUEUE_ROW_HEIGHT_PX}
      overscan={{ main: QUEUE_VIRTUOSO_OVERSCAN_MAIN_PX, reverse: QUEUE_VIRTUOSO_OVERSCAN_REVERSE_PX }}
      rangeChanged={onRangeChanged}
      components={{
        Table: (t) => {
          const { children, className, style, ...rest } = t as HTMLAttributes<HTMLTableElement>;
          return (
            <table
              {...rest}
              className={cn('w-full min-w-0 border-collapse table-fixed', className)}
              style={style}
            >
              <colgroup>
                <col className="min-w-0" style={{ width: '28%' }} />
                <col style={{ width: '12%' }} />
                <col className="min-w-0" style={{ width: '50%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              {children}
            </table>
          );
        },
        TableHead: StickyTableHead,
        TableRow: QueueTableVirtuosoRow,
      }}
      fixedHeaderContent={() => <QueueTableHeaderRow />}
      itemContent={itemContent}
    />
  );
}
