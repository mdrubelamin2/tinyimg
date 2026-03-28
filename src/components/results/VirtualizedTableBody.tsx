import { useVirtualizer } from '@tanstack/react-virtual';
import { ResultRowCells } from './ResultRowCells';
import type { ImageItem } from '@/lib/queue/types';

export interface VirtualizedTableBodyProps {
  itemIds: string[];
  onRemove: (id: string) => void;
  onPreview?: ((item: ImageItem, format: string) => void) | undefined;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  tableRef: React.RefObject<HTMLDivElement | null>;
}

export const VirtualizedTableBody = ({ 
  itemIds, 
  onRemove, 
  onPreview,
  scrollRef,
  tableRef,
}: VirtualizedTableBodyProps) => {
  const virtualizer = useVirtualizer({
    count: itemIds.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  if (itemIds.length === 0) {
    return null;
  }

  return (
    <div
      ref={tableRef}
      style={{ 
        height: `${totalSize}px`, 
        width: '100%',
        position: 'relative',
      }}
    >
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
              height: '80px',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div className="flex w-full border-b border-border/50 bg-surface/20 group hover:bg-muted/30 transition-colors duration-200">
              <ResultRowCells id={id} onRemove={onRemove} onPreview={onPreview} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
