import { useCallback } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import type { ListRange } from 'react-virtuoso';
import { getImageStore } from '@/store/image-store';
import { prioritizeThumbnails } from '@/thumbnails/thumbnail-generator';
import type { ImageItem } from '@/lib/queue/types';
import {
  QUEUE_ROW_HEIGHT_PX,
  QUEUE_VIRTUOSO_OVERSCAN_MAIN_PX,
  QUEUE_VIRTUOSO_OVERSCAN_REVERSE_PX,
} from './constants';
import { StickyTableHead } from './StickyTableHead';
import { QueueTableVirtuosoRow } from './QueueTableVirtuosoRow';
import { QueueTableHeaderRow } from './QueueTableHeaderRow';
import { ResultRowCells } from './ResultRowCells';

export interface VirtualizedQueueTableBodyProps {
  itemIds: string[];
  onRemove: (id: string) => void;
  onPreview?: (item: ImageItem) => void;
  scrollParent: HTMLDivElement | null;
}

export function VirtualizedQueueTableBody({
  itemIds,
  onRemove,
  onPreview,
  scrollParent,
}: VirtualizedQueueTableBodyProps) {
  const onRangeChanged = useCallback(
    (range: ListRange) => {
      const visibleIds = itemIds.slice(range.startIndex, range.endIndex + 1);
      prioritizeThumbnails(visibleIds);
      getImageStore().setVisibleItems(visibleIds);
    },
    [itemIds]
  );

  const itemContent = useCallback(
    (_index: number, rowId: string) => (
      <ResultRowCells id={rowId} onRemove={onRemove} {...(onPreview ? { onPreview } : {})} />
    ),
    [onRemove, onPreview]
  );

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
        Table: (p) => <table {...p} className="w-full min-w-0 table-fixed border-collapse" style={p.style} />,
        TableHead: StickyTableHead,
        TableRow: QueueTableVirtuosoRow,
      }}
      fixedHeaderContent={() => <QueueTableHeaderRow />}
      itemContent={itemContent}
    />
  );
}
