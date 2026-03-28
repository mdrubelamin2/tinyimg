import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { ResultRow } from './ResultRow';
import type { ImageItem } from '@/lib/queue/types';

export interface VirtualizedTableBodyProps {
  itemIds: string[];
  onRemove: (id: string) => void;
  onPreview?: ((item: ImageItem, format: string) => void) | undefined;
}

export const VirtualizedTableBody = ({ 
  itemIds, 
  onRemove, 
  onPreview 
}: VirtualizedTableBodyProps) => {
  const parentRef = useRef<HTMLTableSectionElement>(null);
  
  const virtualizer = useVirtualizer({
    count: itemIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <tbody 
      ref={parentRef} 
      style={{ 
        display: 'block', 
        height: `${virtualizer.getTotalSize()}px`,
        overflow: 'auto',
        contain: 'strict',
      }}
    >
      {virtualRows.map(virtualRow => {
        const id = itemIds[virtualRow.index];
        if (!id) return null;
        return (
          <tr
            key={id}
            data-index={virtualRow.index}
            ref={(node) => virtualizer.measureElement(node)}
            style={{
              display: 'flex',
              position: 'absolute',
              transform: `translateY(${virtualRow.start}px)`,
              width: '100%',
            }}
          >
            <ResultRow id={id} onRemove={onRemove} onPreview={onPreview} />
          </tr>
        );
      })}
    </tbody>
  );
};
