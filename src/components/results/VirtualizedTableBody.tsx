import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { ResultRow } from './ResultRow';
import type { ImageItem } from '@/lib/queue/types';

export interface VirtualizedTableBodyProps {
  itemIds: string[];
  onRemove: (id: string) => void;
  onPreview?: ((item: ImageItem, format: string) => void) | undefined;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export const VirtualizedTableBody = ({ 
  itemIds, 
  onRemove, 
  onPreview,
  scrollRef,
}: VirtualizedTableBodyProps) => {
  const tableRef = useRef<HTMLTableSectionElement>(null);
  
  const virtualizer = useVirtualizer({
    count: itemIds.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 5,
    scrollMargin: 0,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <tbody ref={tableRef}>
      {virtualRows.length > 0 && (
        <tr style={{ height: `${virtualizer.getTotalSize()}px` }}>
          <td style={{ padding: 0, margin: 0 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              {virtualRows.map(virtualRow => {
                const id = itemIds[virtualRow.index];
                if (!id) return null;
                return (
                  <div
                    key={id}
                    data-index={virtualRow.index}
                    ref={(node) => virtualizer.measureElement(node)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <ResultRow id={id} onRemove={onRemove} onPreview={onPreview} />
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
};
