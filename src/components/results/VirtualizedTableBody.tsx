import { useVirtualizer } from '@tanstack/react-virtual';
import { ResultRowCells } from './ResultRowCells';
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
    <div style={{ height: `${totalSize}px`, position: 'relative' }}>
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
              width: '100%',
              height: '80px',
              transform: `translateY(${virtualRow.start}px)`,
            }}
            className="border-b border-border/50 bg-surface/20 group hover:bg-muted/30 transition-colors duration-200"
          >
            <div className="grid w-full h-full" style={{ gridTemplateColumns: 'minmax(0, 2fr) 100px minmax(0, 3fr) 60px' }}>
              <ResultRowCells id={id} onRemove={onRemove} onPreview={onPreview} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
